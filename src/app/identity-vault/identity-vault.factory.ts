import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BrowserVault, DeviceSecurityType, IdentityVaultConfig, Vault, VaultType } from '@ionic-enterprise/identity-vault';
import { defer, from, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class IdentityVaultFactory {
    public vault!: Vault | BrowserVault;

    private defaultMilliseconds = 2000;

    constructor() {
        this.vault = this.createVault();
        this.vault.setValue('test', 'test');
        this.vault.setCustomPasscode('1234');
        this.vault.onPasscodeRequested((_, onComplete) => {
            const passcode = prompt(`Enter pincode. Hint it's 1234`);
            onComplete(passcode);
        });
    }

    public resetConfig(): Observable<void> {
        return this.updateConfig({
            type: VaultType.InMemory,
            customPasscodeInvalidUnlockAttempts: undefined
        });
    }

    public updateConfig(
        config: Partial<IdentityVaultConfig>
    ): Observable<void> {
        return from(
            this.vault.updateConfig({
                ...this.getDefaultConfig(),
                ...config
            })
        );
    }

    public isUnlocked(): Observable<boolean> {
        return from(this.vault.isLocked())
            .pipe(
                map(value => !value)
            );
    }

    public unlockVault(): Observable<void> {
        return defer(() => from(this.vault.unlock())
            .pipe(
                catchError(err => {
                    return throwError(err);
                })
            ));
    }

    public clearVault(): Observable<void> {
        return from(this.vault.clear());
    }

    public isEmpty(): Observable<boolean> {
        return from(this.vault.isEmpty());
    }

    protected createVault(): Vault | BrowserVault {
        const defaultConfig = this.getDefaultConfig();

        return Capacitor.isNativePlatform()
            ? new Vault(defaultConfig)
            : new BrowserVault(defaultConfig);
    }

    private getDefaultConfig(): IdentityVaultConfig {
        return {
            type: VaultType.CustomPasscode,
            deviceSecurityType: DeviceSecurityType.None,
            key: 'com.topicus.healthcare.sample.app',
            lockAfterBackgrounded: this.defaultMilliseconds,
            shouldClearVaultAfterTooManyFailedAttempts: true,
            unlockVaultOnLoad: false,
            customPasscodeInvalidUnlockAttempts: 5
        };
    }
}

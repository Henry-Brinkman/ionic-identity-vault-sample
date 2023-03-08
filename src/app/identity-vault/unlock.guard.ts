import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, UrlTree, } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, map, mergeMap, retryWhen } from 'rxjs/operators';
import { VaultError, VaultErrorCodes } from '@ionic-enterprise/identity-vault';
import { IdentityVaultFactory } from './identity-vault.factory';
import { VaultStateEnum } from './vault-state.enum';

@Injectable({
    providedIn: 'root',
})
export class UnlockGuard implements CanActivate, CanActivateChild {
    constructor(
        private identityVaultFactory: IdentityVaultFactory
    ) {
    }

    public canActivate(): Observable<boolean | UrlTree> {
        return this.canActivateChild();
    }

    public canActivateChild(): Observable<boolean | UrlTree> {
        return this.identityVaultFactory.isEmpty()
            .pipe(
                map((isEmpty: boolean) => isEmpty ? VaultStateEnum.isEmpty : VaultStateEnum.isLocked),
                concatMap((vaultState: VaultStateEnum) => {
                    if (vaultState !== VaultStateEnum.isEmpty) {
                        return this.identityVaultFactory.isUnlocked()
                            .pipe(
                                map((isUnlocked: boolean) => {
                                    return isUnlocked ? VaultStateEnum.isUnlocked : VaultStateEnum.isLocked;
                                })
                            );
                    }
                    return of(vaultState);
                }),
                concatMap((vaultState: VaultStateEnum) => {
                    if (vaultState === VaultStateEnum.isLocked) {
                        return this.identityVaultFactory.unlockVault()
                            .pipe(
                                map(() => VaultStateEnum.isUnlocked),
                                retryWhen((notifier: Observable<VaultError>) => {
                                    return notifier.pipe(
                                        mergeMap((error: VaultError, index: number) => {
                                            if (index < 5 && error.code === VaultErrorCodes.AuthFailed) {
                                                this.showIncorrectPincodeNotification();
                                                return of(null);
                                            }
                                            this.showUnlockErrorNotification(error);
                                            return throwError(error);
                                        })
                                    );
                                }),
                                catchError(() => {
                                    return of(VaultStateEnum.hasError);
                                })
                            );
                    }
                    return of(vaultState);
                }),
                concatMap((vaultState: VaultStateEnum) => {
                    switch (vaultState) {
                        case VaultStateEnum.isUnlocked:
                            return of(true);
                        case VaultStateEnum.hasError:
                            return of(false);
                        case VaultStateEnum.isEmpty:
                        default:
                            return of(false);
                    }
                })
            );
    }

    private showUnlockErrorNotification(vaultError: VaultError): void {
        let errorMessage: string;
        switch (vaultError.code) {
            case VaultErrorCodes.UserCanceledInteraction:
                errorMessage = 'Unlock geannuleerd. Probeer m.b.v. gebruikersnaam en wachtwoord opnieuw in te loggen.';
                break;
            case VaultErrorCodes.AndroidBiometricsLockedOut:
            case VaultErrorCodes.iOSBiometricsLockedOut:
            case VaultErrorCodes.TooManyFailedAttempts:
                errorMessage = 'Te veel mislukte inlogpogingen. Probeer m.b.v. gebruikersnaam en wachtwoord opnieuw in te loggen.';
                break;
            case VaultErrorCodes.MismatchedPasscode:
                errorMessage = 'Pincode komt niet overeen. Probeer m.b.v. gebruikersnaam en wachtwoord opnieuw in te loggen.';
                break;
            default:
                errorMessage = 'Er is iets fout gegaan, probeer opnieuw in te loggen';
                break;
        }
        alert(errorMessage);
    }

    private showIncorrectPincodeNotification(): void {
        alert('Pincode verkeerd ingevoerd. Probeer opnieuw.');
    }
}

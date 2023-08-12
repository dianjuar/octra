import { Injectable } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { AccountLoginMethod } from '@octra/api-types';
import { AuthenticationActions } from './authentication.actions';
import { LoginMode, RootState } from '../index';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationStoreService {
  constructor(private store: Store<RootState>) {}

  me$ = this.store.select((store: RootState) => store.authentication.me);

  authenticated$ = this.store.select(
    (store: RootState) => store.authentication.authenticated
  );
  authType$ = this.store.select(
    (store: RootState) => store.authentication.type
  );
  logoutMessage$ = this.store.select(
    (store: RootState) => store.authentication.logoutMessage
  );
  logoutMessageType$ = this.store.select(
    (store: RootState) => store.authentication.logoutMessageType
  );
  loginErrorMessage$ = this.store.select(
    (store: RootState) => store.authentication.loginErrorMessage
  );

  otherUserLoggedIn$ = this.store.select((store: RootState) => {
    return this.getDifferentUserData(store);
  });

  sameUserWithOpenTask$ = this.store.select((store: RootState) => {
    const differentUserData = this.getDifferentUserData(store);
    if (
      !differentUserData &&
      store.onlineMode.currentSession.currentProject &&
      store.onlineMode.currentSession.task
    ) {
      return store.onlineMode.currentSession;
    }

    return undefined;
  });

  loginOnline(
    method: AccountLoginMethod,
    username?: string,
    password?: string
  ) {
    this.store.dispatch(
      AuthenticationActions.loginOnline.do({
        method,
        username,
        password,
        mode: LoginMode.ONLINE,
      })
    );
  }

  loginDemo() {
    this.store.dispatch(
      AuthenticationActions.loginDemo.do({
        mode: LoginMode.DEMO,
      })
    );
  }

  async loginLocal(files: File[], removeData: boolean) {
    this.store.dispatch(
      AuthenticationActions.loginLocal.do({
        files,
        removeData,
        mode: LoginMode.LOCAL,
      })
    );
  }

  loginAuto(method: AccountLoginMethod, params?: any) {
    this.store.dispatch(AuthenticationActions.loginAuto.do({ method, params }));
  }

  continueSessionAfterAgreement(
    method: AccountLoginMethod,
    sessionToken: string,
    params?: any
  ) {
    this.store.dispatch(
      AuthenticationActions.continueSessionAfterAgreement.do({
        method,
        sessionToken,
        params,
      })
    );
  }

  reauthenticate(
    method: AccountLoginMethod,
    actionAfterSuccess: Action,
    username?: string,
    password?: string
  ) {
    this.store.dispatch(
      AuthenticationActions.reauthenticate.do({
        method,
        username,
        password,
        actionAfterSuccess,
      })
    );
  }

  setReAuthenticationSuccess(actionAfterSuccess: Action) {
    this.store.dispatch(
      AuthenticationActions.needReAuthentication.success({ actionAfterSuccess })
    );
  }

  getDifferentUserData(store: RootState) {
    const previousUser = store.authentication.previousUser;
    if (previousUser?.username && previousUser?.email) {
      if (
        previousUser.username !== store.authentication.me?.username ||
        previousUser.email !== store.authentication.me?.email
      ) {
        return previousUser;
      }
    }
    return undefined;
  }
}

import {createReducer, on} from '@ngrx/store';
import * as LoginActions from './login.actions';
import {LoginMode, LoginState} from '../index';

export const initialState: LoginState = {
  loggedIn: false
};

export const reducer = createReducer(
  initialState,
  on(LoginActions.loginDemo, (state, data) => ({
    ...state,
    mode: LoginMode.DEMO,
    onlineSession: {
      ...data,
      id: 'demo_user',
      project: 'demo',
      jobNumber: -1,
      jobsLeft: 1000,
      dataID: 21343134,
      promptText: '',
      serverDataEntry: null,
      serverComment: ''
    },
    loggedIn: true
  })),
  on(LoginActions.loginLocal, (state, {files}) => ({
    ...state,
    mode: LoginMode.LOCAL,
    loggedIn: true,
    files
  })),
  on(LoginActions.loginURLParameters, (state, {urlParams}) => ({
    ...state,
    mode: LoginMode.URL,
    loggedIn: true,
    urlParams
  })),
  on(LoginActions.loginOnline, (state, {onlineSession}) => ({
    ...state,
    mode: LoginMode.ONLINE,
    loggedIn: true,
    onlineSession
  })),
  on(LoginActions.setMode, (state, {mode}) => ({
    ...state,
    mode
  })),
  on(LoginActions.logout, (state) => ({
    ...state,
    onlineSession: {
      ...state.onlineSession
    },
    loggedIn: false
  })),
  on(LoginActions.clearLocalSession, (state) => ({
    ...state,
    onlineSession: {
      ...state.onlineSession,
      dataID: null
    },
    loggedIn: false
  })),
  on(LoginActions.setAudioURL, (state, {audioURL}) => ({
    ...state,
    onlineSession: {
      ...state.onlineSession,
      audioURL
    }
  })),
  on(LoginActions.setUserData, (state, data) => ({
    ...state,
    onlineSession: {
      ...state.onlineSession,
      ...data
    }
  })),
  on(LoginActions.setServerDataEntry, (state, data) => ({
    ...state,
    onlineSession: {
      ...state.onlineSession,
      ...data
    }
  })),
  on(LoginActions.setLoggedIn, (state, {loggedIn}) => ({
    ...state,
    loggedIn
  }))
);

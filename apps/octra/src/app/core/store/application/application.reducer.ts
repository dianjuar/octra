import {createReducer, on} from '@ngrx/store';
import * as ApplicationActions from './application.actions';
import {ApplicationState, LoadingStatus} from '../index';

export const initialState: ApplicationState = {
  loading: {
    status: LoadingStatus.INITIALIZE,
    progress: 0,
    errors: []
  },
  reloaded: false,
  idb: {
    loaded: false
  }
};

export const reducer = createReducer(
  initialState,
  on(ApplicationActions.load, (state, {progress}) => ({
    ...state,
    loading: {
      ...state.loading,
      status: LoadingStatus.LOADING,
      progress
    }
  })),
  on(ApplicationActions.addError, (state, {error}) => ({
    ...state,
    loading: {
      ...state.loading,
      status: LoadingStatus.FAILED,
      errors: [...state.loading.errors, error]
    }
  })),
  on(ApplicationActions.finishLoading, (state) => ({
    ...state,
    loading: {
      ...state.loading,
      status: LoadingStatus.FINISHED
    }
  }))
);

import {Action, ActionReducer, on} from '@ngrx/store';
import {AnnotationState, LoginMode, OnlineModeState} from '../../index';
import * as fromAnnotation from '../../annotation/annotation.reducer';
import {AnnotationStateReducers} from '../../annotation/annotation.reducer';
import {undoRedo} from 'ngrx-wieder';
import {AnnotationActions} from '../../annotation/annotation.actions';
import {OnlineModeActions} from './online-mode.actions';
import {IDBActions} from '../../idb/idb.actions';
import {DefaultModeOptions, IIDBModeOptions} from '../../../shared/octra-database';
import {hasProperty} from '@octra/utilities';

export const initialState: OnlineModeState = {
  ...fromAnnotation.initialState,
  onlineSession: {
    loginData: {
      id: '',
      project: '',
      jobNumber: -1,
      password: ''
    }
  }
};

// initialize ngrx-wieder with custom config
const {createUndoRedoReducer} = undoRedo({
  allowedActionTypes: [
    AnnotationActions.changeAnnotationLevel.type,
    AnnotationActions.addAnnotationLevel.type,
    AnnotationActions.removeAnnotationLevel.type
  ]
})

export class OnlineModeReducers {
  constructor(private mode: LoginMode) {
  }

  public create(): ActionReducer<AnnotationState, Action> {
    return createUndoRedoReducer(
      initialState,
      ...(new AnnotationStateReducers(this.mode).create()),
      on(OnlineModeActions.loginDemo, (state: OnlineModeState, {onlineSession, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession
          };
        }
        return state;
      }),
      on(OnlineModeActions.login, (state: OnlineModeState, {onlineSession, removeData, mode}) => {
        if (this.mode === mode) {
          if (removeData) {
            return initialState;
          }
          return {
            ...state,
            onlineSession
          };
        }
        return state;
      }),
      on(OnlineModeActions.clearWholeSession, (state: OnlineModeState, {mode}) => {
        if (this.mode === mode) {
          return {
            ...initialState
          };
        }
        return state;
      }),
      on(OnlineModeActions.logout, (state: OnlineModeState, {clearSession, mode}) => {
        if (mode === this.mode) {
          return (clearSession) ? {
            ...initialState,
            onlineSession: {
              ...initialState.onlineSession,
              loginData: state.onlineSession.loginData
            },
            guidelines: state.guidelines,
            projectConfig: state.projectConfig,
            methods: state.methods
          } : {
            ...state,
            savingNeeded: false,
            isSaving: false,
            submitted: false,
            audio: {
              fileName: '',
              sampleRate: 0,
              loaded: false
            },
            histories: {}
          };
        }
        return state;
      }),
      on(OnlineModeActions.setAudioURL, (state: OnlineModeState, {audioURL, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              audioURL
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setUserData, (state: OnlineModeState, {id, project, jobNumber, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              id, project, jobNumber
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setFeedback, (state: OnlineModeState, {feedback, mode}) => {
        if (mode === mode) {
          return {
            ...state,
            feedback
          };
        }
        return state;
      }),
      on(OnlineModeActions.setServerDataEntry, (state: OnlineModeState, {serverDataEntry, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              sessionData: {
                ...state.onlineSession.sessionData,
                serverDataEntry
              }
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setComment, (state: OnlineModeState, {comment, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              comment
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setPromptText, (state: OnlineModeState, {promptText, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              promptText
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setServerComment, (state: OnlineModeState, {serverComment, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              serverComment
            }
          };
        }
        return state;
      }),
      on(OnlineModeActions.setJobsLeft, (state: OnlineModeState, {jobsLeft, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            onlineSession: {
              ...state.onlineSession,
              jobsLeft
            }
          };
        }
        return state;
      }),
      on(IDBActions.loadOptionsSuccess, (state: OnlineModeState, {onlineOptions, demoOptions}) => {
          let result = state;

          let options: IIDBModeOptions;
          if (this.mode === LoginMode.ONLINE) {
            options = onlineOptions;
          } else if (this.mode === LoginMode.DEMO) {
            options = demoOptions;
          } else {
            options = DefaultModeOptions;
          }

          for (const [name, value] of Object.entries(options)) {
            result = this.writeOptionToStore(result, name, value);
          }

          return result;
        }
      ),
      on(OnlineModeActions.setSubmitted, (state: AnnotationState, {submitted, mode}) => {
        if (this.mode === mode) {
          return {
            ...state,
            submitted
          };
        }
        return state;
      })
    );
  }

  writeOptionToStore(state: OnlineModeState, attribute: string, value: any): OnlineModeState {
    const onlineSessionData = {
      jobNumber: -1,
      id: '',
      project: '',
      password: ''
    };

    switch (attribute) {
      case('audioURL'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              audioURL: value
            }
          }
        };
      case('comment'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              comment: value
            }
          }
        };
      case('dataID'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              dataID: value
            }
          }
        };
      case('user'):
        if (value !== undefined) {
          if (hasProperty(value, 'id')) {
            onlineSessionData.id = value.id;
          }
          if (hasProperty(value, 'jobNumber')) {
            onlineSessionData.jobNumber = value.jobNumber;
          }

          if (hasProperty(value, 'project')) {
            onlineSessionData.project = value.project;
          }
        }

        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            loginData: onlineSessionData
          }
        };
      case('prompttext'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              promptText: value
            }
          }
        };
      case('servercomment'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              serverComment: value
            }
          }
        };
      case('submitted'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              submitted: (value !== undefined) ? value : false
            }
          }
        };
      case('feedback'):
        return {
          ...state,
          onlineSession: {
            ...state.onlineSession,
            sessionData: {
              ...state.onlineSession.sessionData,
              feedback: value
            }
          }
        };
    }

    return state;
  }
}

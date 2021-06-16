import {ActionCreator, on, ReducerTypes} from '@ngrx/store';
import {AnnotationState, LoginMode} from '../index';
import {AnnotationActions} from './annotation.actions';
import {IDBActions} from '../idb/idb.actions';
import {ConfigurationActions} from '../configuration/configuration.actions';
import {isUnset} from '@octra/utilities';

export const initialState: AnnotationState = {
  transcript: {
    levels: [],
    links: [],
    levelCounter: 0
  },
  savingNeeded: false,
  isSaving: false,
  audio: {
    loaded: false,
    sampleRate: 0,
    fileName: ''
  },
  logs: [],
  logging: false,
  histories: {}
};

export class AnnotationStateReducers {
  constructor(private mode: LoginMode) {
  }

  create(): ReducerTypes<AnnotationState, ActionCreator[]>[] {
    return [
      on(AnnotationActions.setLevelCounter, (state: AnnotationState, {levelCounter}) =>
        ({
          ...state,
          transcript: {
            ...state.transcript,
            levelCounter: levelCounter
          }
        })),
      on(AnnotationActions.setAnnotation, (state: AnnotationState, {annotation}) => ({
        ...state,
        annotation
      })),
      on(AnnotationActions.clearAnnotation, (state) => ({
        ...state,
        transcript: {
          levels: [],
          links: [],
          levelCounter: 0
        }
      })),
      on(AnnotationActions.overwriteTranscript, (state: AnnotationState, {annotation}) => ({
        ...state,
        ...annotation
      })),
      on(AnnotationActions.changeAnnotationLevel, (state: AnnotationState, {level}) => {
        const annotationLevels = state.transcript.levels;
        const index = annotationLevels.findIndex(a => a.id === level.id);

        if (index > -1 && index < annotationLevels.length) {
          return {
            ...state,
            transcript: {
              ...state.transcript,
              levels: [
                ...state.transcript.levels.slice(0, index),
                {
                  ...level
                },
                ...state.transcript.levels.slice(index + 1)
              ]
            }
          };
        } else {
          console.error(`can't change level because index not valid.`);
        }

        return state;
      }),
      on(AnnotationActions.addAnnotationLevel, (state: AnnotationState, {level}) =>
        ({
          ...state,
          transcript: {
            ...state.transcript,
            levels: [
              ...state.transcript.levels,
              level
            ]
          }
        })),
      on(AnnotationActions.removeAnnotationLevel, (state: AnnotationState, {id}) => {
        if (id > -1) {
          const index = state.transcript.levels.findIndex((a) => (a.id === id));
          if (index > -1) {
            return {
              ...state,
              transcript: {
                ...state.transcript,
                levels: [
                  ...state.transcript.levels.slice(0, index),
                  ...state.transcript.levels.slice(index + 1)
                ]
              }
            }
          } else {
            console.error(`can't remove level because index not valid.`);
          }
        } else {
          console.error(`can't remove level because id not valid.`);
        }

        return state;
      }),
      on(IDBActions.loadAnnotationSuccess, (state: AnnotationState, annotations) => {
        return {
          ...state,
          transcript: {
            ...annotations[this.mode]
          }
        };
      }),
      on(AnnotationActions.setSavingNeeded, (state: AnnotationState, {savingNeeded}) => ({
        ...state,
        savingNeeded
      })),
      on(AnnotationActions.setIsSaving, (state: AnnotationState, {isSaving}) => ({
        ...state,
        isSaving
      })),
      on(AnnotationActions.setCurrentEditor, (state: AnnotationState, {currentEditor}) => ({
        ...state,
        currentEditor
      })),

      on(AnnotationActions.addLog, (state: AnnotationState, {log, mode}) => {
        if (mode === mode) {
          return {
            ...state,
            logs: [...state.logs, log]
          };
        }
        return state;
      }),
      on(AnnotationActions.saveLogs, (state: AnnotationState, {logs}) => ({
        ...state,
        logs
      })),
      on(AnnotationActions.setLogging, (state: AnnotationState, {logging}) => ({
        ...state,
        logging
      })),
      on(AnnotationActions.setTranscriptionState, (state: AnnotationState, newState) => ({...state, ...newState})),
      on(AnnotationActions.clearLogs, (state) => ({
        ...state,
        logs: []
      })),
      on(IDBActions.loadLogsSuccess, (state: AnnotationState, logs) => {
        return {
          ...state,
          logs: logs[this.mode]
        };
      }),
      on(ConfigurationActions.projectConfigurationLoaded, (state: AnnotationState, {projectConfig}) =>
        ({
          ...state,
          projectConfig
        })),
      on(ConfigurationActions.loadGuidelinesSuccess, (state: AnnotationState, {guidelines}) => ({
        ...state,
        guidelines
      })),
      on(IDBActions.loadOptionsSuccess, (state: AnnotationState, {variables}) => {
        let result = state;

        for (const variable of variables) {
          result = this.writeOptionToStore(result, variable.name, variable.value);
        }

        return result;
      }),
      on(ConfigurationActions.loadMethodsSuccess, (state: AnnotationState, methods) =>
        ({
          ...state,
          methods
        })),
      on(AnnotationActions.setAudioLoaded, (state: AnnotationState, audioState) => {
          return {
            ...state,
            audio: {
              ...state.audio,
              ...audioState
            }
          };
        }
      )
    ];
  }

  writeOptionToStore(state: AnnotationState, attribute: string, value: any): AnnotationState {
    switch (attribute) {
      case('interface'):
        return {
          ...state,
          currentEditor: (!isUnset(value)) ? value : '2D-Editor'
        };
      case('logging'):
        return {
          ...state,
          logging: (!isUnset(value)) ? value : true
        };
    }

    return state;
  }
}

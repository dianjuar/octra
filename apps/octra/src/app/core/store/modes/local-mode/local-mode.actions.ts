import { AnnotationActions } from '../../annotation/annotation.actions';
import {
  createAction,
  createActionGroup,
  emptyProps,
  props,
} from '@ngrx/store';
import { SessionFile } from '../../../obj/SessionFile';
import { LoginMode } from '../../index';

export class LocalModeActions extends AnnotationActions {
  public static setSessionFile = createAction(
    `local mode Set SessionFile`,
    props<{
      sessionFile: SessionFile;
    }>()
  );

  static override clearSessionStorage = createActionGroup({
    source: `local mode/ session storage/ clear`,
    events: {
      success: emptyProps(),
      fail: emptyProps(),
    },
  }) as any;
}

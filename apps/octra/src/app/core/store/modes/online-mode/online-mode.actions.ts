import { AnnotationActions } from '../../annotation/annotation.actions';
import { Action, createAction, createActionGroup, emptyProps, props } from "@ngrx/store";
import { LoginMode } from '../../index';
import { CurrentAccountDto, ProjectDto, TaskDto } from "@octra/api-types";
import { OnlineSession } from '../../annotation';
import { URLParameters } from '../../application';
import { HttpErrorResponse } from '@angular/common/http';

export class OnlineModeActions extends AnnotationActions {
  public static loginDemo = createAction(
    `online mode Login Demo`,
    props<{
      onlineSession: OnlineSession;
      mode: LoginMode.DEMO;
    }>()
  );

  public static loginURLParameters = createAction(
    `online mode Login URLParameters`,
    props<{
      urlParams: URLParameters;
    }>()
  );

  public static setServerDataEntry = createAction(
    `online mode Set serverDataEntry`,
    props<{
      serverDataEntry: TaskDto;
      mode: LoginMode;
    }>()
  );

  public static setFeedback = createAction(
    `annotation Set feedback`,
    props<{
      feedback: any;
      mode: LoginMode;
    }>()
  );

  static changeComment = createActionGroup({
    source: `annotation/change comment`,
    events: {
      do: props<{
        mode: LoginMode;
        comment: string;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static clearOnlineSession = createActionGroup({
    source: `annotation/ clear online session`,
    events: {
      do: props<{
        mode: LoginMode;
        actionAfterSuccess: Action;
      }>(),
      success: props<{
        mode: LoginMode;
        actionAfterSuccess: Action;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static loadOnlineInformationAfterIDBLoaded = createActionGroup({
    source: `annotation/ load task information`,
    events: {
      do: props<{
        projectID: string;
        taskID: string;
        mode: LoginMode;
        actionAfterSuccess?: Action;
      }>(),
      success: props<{
        mode: LoginMode;
        me: CurrentAccountDto;
        currentProject?: ProjectDto;
        task?: TaskDto;
        actionAfterSuccess?: Action;
      }>(),
      fail: props<{
        error: HttpErrorResponse;
      }>(),
    },
  });

  static endTranscription = createActionGroup({
      source: 'annotation/ redirect to transcription end',
      events: {
        do: props<{clearSession:boolean, mode: LoginMode}>()
      },
    });

}

import { Component } from '@angular/core';
import { AppInfo } from '../../../app.info';
import { OctraModal } from '../types';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';

export enum ModalDeleteAnswer {
  DELETE = 'DELETE',
  ABORT = 'ABORT',
}

@Component({
  selector: 'octra-transcription-delete-modal',
  templateUrl: './transcription-delete-modal.component.html',
  styleUrls: ['./transcription-delete-modal.component.scss'],
})
export class TranscriptionDeleteModalComponent extends OctraModal {
  public static options: NgbModalOptions = {
    keyboard: false,
    backdrop: false,
  };

  AppInfo = AppInfo;

  constructor(protected override activeModal: NgbActiveModal) {
    super('transcriptionDelete', activeModal);
  }
}

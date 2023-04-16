import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {SettingsService} from '../../shared/service';
import {AppStorageService} from '../../shared/service/appstorage.service';
import {OctraModal} from '../types';
import { NgbActiveModal, NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: 'octra-prompt-modal',
  templateUrl: './prompt-modal.component.html',
  styleUrls: ['./prompt-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class PromptModalComponent extends OctraModal {
  public formatConverter;
  protected data = undefined;

  constructor(modalService: NgbModal, public appStorage: AppStorageService, private settService: SettingsService,
              private cd: ChangeDetectorRef, protected override activeModal: NgbActiveModal) {
    super('promptModal', activeModal);
  }

  public override close() {
    this.cd.markForCheck();
    this.cd.detectChanges();
    return super.close();
  }
}

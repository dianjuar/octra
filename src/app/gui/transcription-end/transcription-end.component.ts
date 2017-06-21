import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {SessionService} from '../../service/session.service';
import {TranscriptionService} from '../../service/transcription.service';
import {UserInteractionsService} from '../../service/userInteractions.service';
import {SubscriptionManager} from '../../shared';
import {SettingsService} from '../../service/settings.service';
import {NavbarService} from '../../service/navbar.service';


@Component({
  selector: 'app-transcription-submitted',
  templateUrl: './transcription-end.component.html',
  styleUrls: ['./transcription-end.component.css']
})
export class TranscriptionEndComponent implements OnInit, OnDestroy, AfterViewInit {
  private subscrmanager: SubscriptionManager;

  constructor(private router: Router,
              private sessService: SessionService,
              private tranService: TranscriptionService,
              private uiService: UserInteractionsService,
              private settService: SettingsService,
              private navService: NavbarService) {

    this.subscrmanager = new SubscriptionManager();
    this.navService.show_interfaces = false;
    this.navService.show_export = false;
    this.navService.dataloaded = false;
  }

  ngOnInit() {
    this.sessService.submitted = true;
  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  leave() {
    this.tranService.endTranscription();

    this.clearData();
    this.sessService.clearLocalStorage();

    this.router.navigate(['/logout']);
  }

  clearData() {
    this.sessService.submitted = false;
    this.sessService.annotation = null;

    this.sessService.feedback = null;
    this.sessService.comment = '';
    this.sessService.logs = [];
    this.uiService.elements = [];
    this.settService.clearSettings();
  }
}
import { Component, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { AppInfo } from '../../../app.info';
import { navigateTo } from '@octra/ngx-utilities';
import { AudioService, SettingsService } from '../../shared/service';
import { AppStorageService } from '../../shared/service/appstorage.service';
import { LoadingStatus } from '../../store';
import { DefaultComponent } from '../../component/default.component';
import { ApplicationStoreService } from '../../store/application/application-store.service';

@Component({
  selector: 'octra-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
})
export class LoadingComponent extends DefaultComponent implements OnInit {
  @Output() loaded = false;
  public text = '';
  public state = '';
  public warning = '';

  loading: {
    status: LoadingStatus;
    progress: number;
    errors: string[];
  } = {
    status: LoadingStatus.INITIALIZE,
    progress: 0,
    errors: [],
  };

  constructor(
    private langService: TranslocoService,
    public settService: SettingsService,
    public appStorage: AppStorageService,
    public appStoreService: ApplicationStoreService,
    public audio: AudioService,
    private router: Router
  ) {
    super();
  }

  ngOnInit() {
    this.langService
      .selectTranslate('g.please wait')
      .subscribe((translation) => {
        this.text = translation + '... ';
      });

    this.subscrManager.add(
      this.appStoreService.loading$.subscribe({
        next: (loading) => {
          this.loading = loading;
        },
      })
    );
  }

  retry() {
    location.reload();
  }

  goBack() {
    this.appStorage.logout();
    navigateTo(this.router, ['/login'], AppInfo.queryParamsHandling).catch(
      (error) => {
        console.error(error);
      }
    );
  }
}

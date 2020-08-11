import {Injectable} from '@angular/core';

import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';
import {Observable} from 'rxjs';
import {AppInfo} from '../../../app.info';
import {SettingsService} from '../service';
import {AppStorageService} from '../service/appstorage.service';
import {Functions} from '@octra/utilities';
import {LoginMode} from '../../store';

@Injectable()
export class TranscActivateGuard implements CanActivate {

  constructor(private appStorage: AppStorageService,
              private router: Router,
              private settService: SettingsService) {

  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    if (this.appStorage.useMode !== LoginMode.LOCAL) {
      if (!this.settService.allloaded) {

        const params = AppInfo.queryParamsHandling;
        params.fragment = route.fragment;
        params.queryParams = route.queryParams;

        Functions.navigateTo(this.router, ['/user/load'], params).catch((error) => {
          console.error(error);
        });
        return false;
      }
    } else {
      if (!this.settService.allloaded) {
        const params = AppInfo.queryParamsHandling;
        params.fragment = route.fragment;
        params.queryParams = route.queryParams;

        Functions.navigateTo(this.router, ['/user/transcr/reload-file'], params).catch((error) => {
          console.error(error);
        });
        return false;
      }
    }
    return true;
  }
}

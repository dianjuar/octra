import { Injectable } from '@angular/core';

import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { map, Observable } from 'rxjs';
import { AppInfo } from '../../../app.info';
import { LoadingStatus, LoginMode, RootState } from '../../store';
import { navigateTo } from '@octra/ngx-utilities';
import { ApplicationStoreService } from '../../store/application/application-store.service';
import { Store } from '@ngrx/store';
import { TranscriptionService } from "../service";

@Injectable()
export class TranscActivateGuard implements CanActivate {
  constructor(
    private appStoreService: ApplicationStoreService,
    private transcrService: TranscriptionService,
    private router: Router,
    private store: Store<RootState>
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | boolean {
    return this.store.pipe(
      map((state) => {
        if (state.application.loading.status !== LoadingStatus.FINISHED) {
          console.error(`audio not loaded`);
          const params = AppInfo.queryParamsHandling;
          params.fragment = route.fragment!;
          params.queryParams = route.queryParams;

          navigateTo(this.router, ['/load'], params).catch((error) => {
            console.error(error);
          });
          return false;
        }
        return true;
      })
    );
  }
}

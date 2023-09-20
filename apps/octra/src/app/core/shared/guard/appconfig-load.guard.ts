import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
} from '@angular/router';
import { inject } from '@angular/core';
import { ApplicationStoreService } from '../../store/application/application-store.service';
import { map, take } from 'rxjs';
import { RoutingService } from '../service/routing.service';
import { AppInfo } from '../../../app.info';

export const CONFIG_LOADED_GUARD: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const applicationStoreService = inject(ApplicationStoreService);
  return applicationStoreService.appconfig$.pipe(
    map((a) => {
      return a !== undefined;
    })
  );
};

export const APP_INITIALIZED_GUARD: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const routingService: RoutingService = inject(RoutingService);
  return inject(ApplicationStoreService).appInitialized.pipe(
    take(1),
    map((a) => {
      if (!a) {
        routingService.navigate("guard app init, to load", ['/load'], AppInfo.queryParamsHandling);
      }
      return a;
    })
  );
};

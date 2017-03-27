//angular
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { HttpModule, JsonpModule, Http } from "@angular/http";
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';


//third-party
import { Ng2Bs3ModalModule } from "ng2-bs3-modal/ng2-bs3-modal";
import { Ng2Webstorage } from 'ng2-webstorage';


//other
import { LanguageLoader } from './shared';
import {
	AudioNavigationComponent,
	AudioplayerComponent,
	AudioplayerDirective,
	AudioviewerComponent,
	AudioviewerConfig,
	AudioviewerDirective,
	LoupeComponent,
	TranscrEditorComponent,
	CircleLoupeComponent,
	AlertComponent,
	DropZoneComponent,
	OctraModalComponent
} from "./component";
import {
	AudioplayerGUIComponent,
	LoadingComponent,
	LoginComponent,
	LogoutComponent,
	MembersAreaComponent,
	NavigationComponent,
	OverlayGUIComponent,
	ReloadFileComponent,
	SignalGUIComponent,
	TranscriptionComponent,
	TranscriptionSubmitComponent,
	TranscriptionSubmittedComponent,
	TranscrOverviewComponent,
	TranscrWindowComponent,
	FastbarComponent
} from "./gui";

import { routing } from "./app.routes";
import { TimespanPipe, ProcentPipe, SecondsPipe, LeadingNullPipe } from "./pipe";

import { APIService, NavbarService, AudioService, ModalService, KeymappingService, SessionService, SettingsService } from "./service";

import { DeALoginGuard, LogoutGuard, MembersAreaGuard, TranscrSubmittedGuard, ALoginGuard,SettingsGuard } from "./guard";

import { AppComponent } from "./app.component";

import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { TranscrGuidelinesComponent } from './gui/transcr-guidelines/transcr-guidelines.component';
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: Http) {
	return new LanguageLoader(http, "./assets/i18n/octra/octra_", ".json");
}

@NgModule({
	declarations: [
		AppComponent,
		AudioNavigationComponent,
		AudioplayerComponent,
		AudioplayerDirective,
		AudioplayerGUIComponent,
		AudioviewerComponent,
		AudioviewerDirective,
		CircleLoupeComponent,
		LoadingComponent,
		LoginComponent,
		LogoutComponent,
		LoupeComponent,
		MembersAreaComponent,
		NavigationComponent,
		OverlayGUIComponent,
		ProcentPipe,
		SecondsPipe,
		LeadingNullPipe,
		SignalGUIComponent,
		TimespanPipe,
		TranscrEditorComponent,
		TranscriptionComponent,
		TranscriptionSubmitComponent,
		TranscriptionSubmittedComponent,
		TranscrOverviewComponent,
		TranscrWindowComponent,
		AlertComponent,
		ReloadFileComponent,
		DropZoneComponent,
		FastbarComponent,
		OctraModalComponent,
		TranscrGuidelinesComponent
	],
	imports     : [
		BrowserModule,
		BrowserAnimationsModule,
		TranslateModule.forRoot({
			loader: {
				provide   : TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps      : [ Http ]
			}
		}),
		NgbModule.forRoot(),
		FormsModule,
		HttpModule,
		JsonpModule,
		Ng2Webstorage,
		Ng2Bs3ModalModule,
		ReactiveFormsModule,
		routing
	],
	bootstrap   : [
		AppComponent
	],
	providers   : [
		ALoginGuard,
		AudioService,
		AudioviewerConfig,
		APIService,
		DeALoginGuard,
		ModalService,
		KeymappingService,
		LogoutGuard,
		MembersAreaGuard,
		SettingsGuard,
		SessionService,
		TranscrSubmittedGuard,
		TranslateService,
		NavbarService,
		SettingsService
	]
})

export class AppModule {
}

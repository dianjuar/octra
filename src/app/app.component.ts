import { Component, OnDestroy } from '@angular/core';
import { APIService } from "./service/api.service";
import { TranslateService } from "@ngx-translate/core";
import { SessionService } from "./service/session.service";
import { SettingsService } from "./service/settings.service";
import { SubscriptionManager } from "./shared/SubscriptionManager";
import { isNullOrUndefined } from "util";
import { isUndefined } from "util";

@Component({
	selector   : 'octra',
	templateUrl: 'app.component.html',
	styleUrls  : [ 'app.component.css' ]
})

export class AppComponent implements OnDestroy {
	version: string = "1.0.6";

	private subscrmanager: SubscriptionManager;

	constructor(private api: APIService,
				private langService: TranslateService,
				private sessService: SessionService,
				private settingsService: SettingsService) {
		this.subscrmanager = new SubscriptionManager();

		//load settings
		this.subscrmanager.add(this.settingsService.settingsloaded.subscribe(
			this.onSettingsLoaded
		));

		if (this.settingsService.validated) {
			this.onSettingsLoaded();
		}
	}

	onSettingsLoaded = () => {
		//settings have been loaded
		if (isNullOrUndefined(this.settingsService.app_settings)) {
			throw "config.json not set correctly";
		}
		else {
			if (this.settingsService.validated) {
				this.api.init(this.settingsService.app_settings.audio_server.url + "WebTranscribe");
			}

			if (!this.settingsService.app_settings.octra.responsive.enabled) {
				//set fixed width
				let head = document.head || document.getElementsByTagName('head')[ 0 ];
				let style = document.createElement('style');
				style.type = 'text/css';
				style.innerText = ".container {width:" + this.settingsService.app_settings.octra.responsive.fixedwidth + "px}";
				head.appendChild(style);
			}
		}

		//define languages
		let languages = this.settingsService.app_settings.octra.languages;
		let browser_lang = this.langService.getBrowserLang();

		this.langService.addLangs(languages);

		//check if browser language is available in translations
		if (isNullOrUndefined(this.sessService.language) || this.sessService.language == "") {
			if (!isUndefined(this.langService.getLangs().find((value) => {
					return value == browser_lang
				}))) {
				this.langService.use(browser_lang);
			}
			else {
				//use first language defined as default language
				this.langService.use(languages[0]);
			}
		}
		else {
			this.langService.use(this.sessService.language);
		}

	};

	ngOnDestroy() {
		this.subscrmanager.destroy();
	}
}

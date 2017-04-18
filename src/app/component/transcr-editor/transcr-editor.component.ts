import {
	Component, OnInit, OnDestroy, EventEmitter, Output, ChangeDetectorRef, Input, OnChanges
} from '@angular/core';
import { TranscrEditorConfig } from "./config/te.config";
import { TranslateService } from "@ngx-translate/core";

import { KeyMapping, BrowserInfo, Functions, SubscriptionManager } from "../../shared";
import { TranscrEditorConfigValidator } from "./validator/TranscrEditorConfigValidator";
import { SettingsService } from "../../service/settings.service";
import { TranscriptionService } from "../../service/transcription.service";
import { isNullOrUndefined } from "util";

@Component({
	selector   : 'app-transcr-editor',
	templateUrl: 'transcr-editor.component.html',
	styleUrls  : [ 'transcr-editor.component.css' ],
	providers  : [ TranscrEditorConfig ]
})

export class TranscrEditorComponent implements OnInit, OnDestroy, OnChanges {
	get is_typing(): boolean {
		return this._is_typing;
	}

	@Output('loaded') loaded: EventEmitter<boolean> = new EventEmitter<boolean>();
	@Output('onkeyup') onkeyup: EventEmitter<any> = new EventEmitter<any>();
	@Output('marker_insert') marker_insert: EventEmitter<string> = new EventEmitter<string>();
	@Output('marker_click') marker_click: EventEmitter<string> = new EventEmitter<string>();
	@Output('typing') typing: EventEmitter<string> = new EventEmitter<string>();

	private _settings: TranscrEditorConfig;
	private subscrmanager: SubscriptionManager;
	private init: number = 0;
	public focused:boolean = false;

	@Input() visible: boolean = true;
	@Input() markers: any = true;
	@Input() easymode: boolean = true;

	get rawText(): string {
		return this.tidyUpRaw(this._rawText);
	}

	set rawText(value: string) {
		this._rawText = this.tidyUpRaw(value);
		this.init = 0;
		this.textfield.summernote('code', this.rawToHTML(this._rawText));
	}

	get Settings(): any {
		return this._settings;
	}

	get html(): string {
		return (this.textfield) ? this.textfield.summernote('code') : "";
	}

	set Settings(value: any) {
		this._settings = value;
	}

	constructor(private cd: ChangeDetectorRef,
				private settingsService: SettingsService,
				private langService: TranslateService,
				private transcrService: TranscriptionService) {

		this._settings = new TranscrEditorConfig().Settings;
		this.subscrmanager = new SubscriptionManager();
		this.validateConfig();
	}

	public textfield: any = null;
	private _rawText: string = "";
	private _html: string = "";
	private summernote_ui: any = null;
	private _is_typing: boolean = false;
	private lastkeypress: number = 0;

	ngOnInit() {
		this.Settings.height = 100;
		this.initialize();
	}

	ngOnChanges(obj) {
		let renew:boolean = false;
		if (!isNullOrUndefined(obj.markers) && obj.markers.previousValue != obj.markers.newValue){
			renew = true;
		}
		if (!isNullOrUndefined(obj.easymode) && obj.easymode.previousValue != obj.easymode.newValue){
			renew = true;
		}

		if(renew){
			let navigation = this.initNavigation();

			this.textfield.summernote('destroy');
			this.textfield.summernote({
				height             : this.Settings.height,
				focus              : true,
				disableDragAndDrop : true,
				disableResizeEditor: true,
				disableResizeImage : true,
				popover            : [],
				airPopover         : [],
				toolbar            : [
					[ 'mybutton', navigation.str_array ]
				],
				shortcuts          : false,
				buttons            : navigation.buttons,
				callbacks          : {
					onKeydown: this.onKeyDownSummernote,
					onKeyup  : this.onKeyUpSummernote,
					onPaste  : function (e) {
						//prevent copy paste
						e.preventDefault();
					}
				}
			});
		}
	}

	/**
	 * converts the editor's html text to raw text
	 * @returns {string}
	 */
	getRawText = () => {
		let result: string = "";
		let html = this.textfield.summernote('code');

		html = "<p>" + html + "</p>";
		let dom = jQuery(html);

		let test = dom.text();
		let replace_func = (i, elem) => {
			let attr = jQuery(elem).attr("data-marker-code");
			if (elem.type == "select-one") {
				let value = jQuery(elem).attr("data-value");
				attr += "=" + value;
			}
			if (attr) {
				for (let i = 0; i < this.markers.length; i++) {
					let marker = this.markers[ i ];
					if (attr === marker.code) {

						jQuery(elem).replaceWith(Functions.escapeHtml(attr));
						break;
					}
				}
			}
			else if (jQuery(elem).attr("class") != "error_underline") {
				jQuery(elem).remove();
			}
		};

		jQuery.each(dom.children(), replace_func);
		result = dom.text();

		return result;
	};

	ngOnDestroy() {
		this.destroy();
	}

	public update() {
		this.destroy();
		this.initialize();
		this.cd.detectChanges();
	}

	/**
	 * destroys the summernote editor
	 */
	private destroy() {
		this.textfield.summernote('destroy');
		//delete tooltip overlays
		jQuery(".tooltip").remove();
		this.subscrmanager.destroy();
	}

	/**
	 * initializes the editor and the containing summernote editor
	 */
	public initialize = () => {
		this.summernote_ui = jQuery.summernote.ui;
		let Navigation = this.initNavigation();

		this.textfield = jQuery(".textfield");
		this.textfield.summernote({
			height             : this.Settings.height,
			focus              : true,
			disableDragAndDrop : true,
			disableResizeEditor: true,
			disableResizeImage : true,
			popover            : [],
			airPopover         : [],
			toolbar            : [
				[ 'mybutton', Navigation.str_array ]
			],
			shortcuts          : false,
			buttons            : Navigation.buttons,
			callbacks          : {
				onKeydown: this.onKeyDownSummernote,
				onKeyup  : this.onKeyUpSummernote,
				onPaste  : function (e) {
					//prevent copy paste
					e.preventDefault();
				},
				onChange : () => {
					this.init++;

					if (this.init == 1) {
						this.focus(true);
					} else if(this.init > 1){
						this.textfield.summernote("restoreRange");
					}
				},
				onBlur: () =>{
				}
			}
		});

		this.textfield.summernote('removeModule', 'statusbar');

		this.loaded.emit(true);
	};

	/**
	 * initializes the navigation bar of the editor
	 */
	initNavigation() {
		let result = {
			buttons  : {},
			str_array: []
		};

		for (let i = 0; i < this.markers.length; i++) {
			let marker = this.markers[ i ];
			result.buttons[ marker.code ] = this.createButton(marker);
			result.str_array.push(marker.code);
		}

		return result;
	}

	/**
	 * creates a marker button for the toolbar
	 * @param marker
	 * @returns {any}
	 */
	createButton(marker): any {
		let platform = BrowserInfo.platform;
		let icon = "";
		if(!this.easymode) {
			icon = "<img src='" + marker.icon_url + "' class='btn-icon' style='height:16px;'/> <span class='btn-description'>" + marker.button_text + "</span><span class='btn-shortcut'> [" + marker.shortcut[ platform ] + "]</span>";
			if (this.Settings.responsive) {
				icon = "<img src='" + marker.icon_url + "' class='btn-icon' style='height:16px;'/> <span class='btn-description hidden-xs hidden-sm'>" + marker.button_text + "</span><span class='btn-shortcut hidden-xs hidden-sm hidden-md'> [" + marker.shortcut[ platform ] + "]</span>";
			}
		} else {
			icon = "<img src='" + marker.icon_url + "' class='btn-icon' style='height:16px;'/>";
		}
		// create button
		let button = this.summernote_ui.button({
			contents: icon,
			tooltip : marker.description + " Shortcut: [" + marker.shortcut[ platform ] + "]",
			click   : () => {
				// invoke insertText method with 'hello' on editor module.
				this.insertMarker(marker.code, marker.icon_url);
				this.marker_click.emit(marker.code);
			}
		});
		return button.render();   // return button as jquery object
	}

	/**
	 * inserts a marker to the editors html
	 * @param marker_code
	 * @param icon_url
	 */
	insertMarker = function (marker_code, icon_url) {
		let element = document.createElement("img");
		element.setAttribute("src", icon_url);
		element.setAttribute("class", "btn-icon-text");
		element.setAttribute("style", "height:16px");
		element.setAttribute("data-marker-code", marker_code);
		element.setAttribute("alt", marker_code);

		this.textfield.summernote('editor.insertNode', element);
		this.updateTextField();
	};

	/**
	 * called when key pressed in editor
	 * @param $event
	 */
	onKeyDownSummernote = ($event) => {
		let comboKey = KeyMapping.getShortcutCombination($event);
		let platform = BrowserInfo.platform;

		if (comboKey != "") {
			if (this.isDisabledKey(comboKey))
				$event.preventDefault();
			else {
				for (let i = 0; i < this.markers.length; i++) {
					let marker: any = this.markers[ i ];
					if (marker.shortcut[ platform ] == comboKey) {
						$event.preventDefault();
						let test = this.textfield.summernote("createRange");
						this.insertMarker(marker.code, marker.icon_url);
						this.marker_insert.emit(marker.code);
						return;
					}
				}
			}
		}

		this.lastkeypress = Date.now();
	};

	/**
	 * called after key up in editor
	 * @param $event
	 */
	onKeyUpSummernote = ($event) => {
		//update rawText
		this.updateTextField();
		this.onkeyup.emit($event);

		setTimeout(() => {
			if (Date.now() - this.lastkeypress < 500) {
				if (!this._is_typing && this.focused) {
					this.typing.emit("started");
				}
				this._is_typing = true;
			}
			else {
				if (this._is_typing && this.focused) {
					this.typing.emit("stopped");
				}
				this._is_typing = false;
			}
		}, 500);
	};

	/**
	 * updates the raw text of the editor
	 */
	updateTextField() {
		this._rawText = this.getRawText();
	}

	/**
	 * checks if the combokey is part of the configs disabledkeys
	 * @param comboKey
	 * @returns {boolean}
	 */
	private isDisabledKey(comboKey: string): boolean {
		for (let i = 0; i < this.Settings.disabled_keys.length; i++) {
			if (this.Settings.disabled_keys[ i ] === comboKey) {
				return true;
			}
		}
		return false;
	}

	/**
	 * adds the comboKey to the list of disabled Keys
	 * @param comboKey
	 * @returns {boolean}
	 */
	public addDisableKey(comboKey: string): boolean {
		for (let i = 0; i < this.Settings.disabled_keys.length; i++) {
			if (this.Settings.disabled_keys[ i ] === comboKey) {
				return false;
			}
		}
		this.Settings.disabled_keys.push(comboKey);
		return true;
	}

	/**
	 * removes the combokey of list of disabled keys
	 * @param comboKey
	 * @returns {boolean}
	 */
	public removeDisableKey(comboKey: string): boolean {
		let j = -1;
		for (let i = 0; i < this.Settings.disabled_keys.length; i++) {
			if (this.Settings.disabled_keys[ i ] === comboKey) {
				j = i;
				return true;
			}
		}
		this.Settings.disabled_keys.splice(j, 1);

		return (j > -1) ? true : false;
	}

	/**
	 * converts raw text of markers to html
	 * @param rawtext
	 * @returns {string}
	 */
	private rawToHTML(rawtext: string): string {
		let result: string = rawtext;

		if (rawtext != "") {
			//replace markers with no wrap
			for (let i = 0; i < this.markers.length; i++) {
				let marker = this.markers[ i ];

				let regex = new RegExp("(\\s)*(" + Functions.escapeRegex(marker.code) + ")(\\s)*", "g");

				let replace_func = (x, g1, g2, g3) => {
					let s1 = (g1) ? g1 : "";
					let s2 = (g2) ? g2 : "";
					let s3 = (g3) ? g3 : "";
					return s1 + "<img src='" + marker.icon_url + "' class='btn-icon-text' style='height:16px;' data-marker-code='" + marker.code + "' alt='"+ marker.code + "'/>" + s3;
				};

				result = result.replace(regex, replace_func);

			}

			result = result.replace(/\s+$/g, "&nbsp;");
			result = (result !== "") ? "" + result + "" : "";
		}

		return result;
	}

	/**
	 * set focus to the very last position of the editors text
	 */
	public focus = (later: boolean = false) => {
		this.focused = true;
		let func = () => {
			if (this.rawText != "") {
				Functions.placeAtEnd(jQuery('.note-editable.panel-body')[ 0 ]);
			}
			this.textfield.summernote('focus');
		};

		if (later) {
			setTimeout(
				() => {
					func();
				}, 200
			)
		}
		else {
			func();
		}
	};

	/**
	 * tidy up the raw text, remove white spaces etc.
	 * @param raw
	 * @returns {string}
	 */
	private tidyUpRaw(raw: string):string {
		return tidyUpAnnotation(raw, this.transcrService.guidelines);
	}

	/**
	 * replace markers of the input string with its html pojection
	 * @param input
	 * @param use_wrap
	 * @returns {string}
	 */
	private replaceMarkersWithHTML(input: string, use_wrap: boolean): string {
		let result = input;

		for (let i = 0; i < this.markers.length; i++) {
			let marker = this.markers[ i ];
			result = result.replace(marker, "<img src='" + marker.icon_url + "' class='btn-icon-text' style='height:16px;' data-marker-code='" + marker.code + "' alt='" + marker.code + "'/>");
		}
		return result;
	}

	private validateConfig() {
		let validator: TranscrEditorConfigValidator = new TranscrEditorConfigValidator();
		let validation = validator.validateObject(this._settings);
		if (!validation.success)
			throw validation.error;

	}

	private validate() {
		let val: any[] = this.transcrService.validate(this._rawText);
		let ok = this.underlineTextRed(val);
		ok = this.rawToHTML(ok);
		this.textfield.summernote('code', ok);
	}

	private underlineTextRed(validation: any[]) {
		let result = this._rawText;

		let puffer = {};

		if (validation.length > 0) {
			for (let i = 0; i < validation.length; i++) {
				if(!puffer.hasOwnProperty("p" + validation[i].start)){
					puffer["p" + validation[i].start] = ""
				}
				if(!puffer.hasOwnProperty("p" + (validation[i].start + validation[i].length))){
					puffer["p" + (validation[i].start + validation[i].length)] = ""
				}

				puffer["p" + validation[i].start] += "<div class='error_underline'>";
				puffer["p" + (validation[i].start + validation[i].length)] = "</div>" + puffer["p" + (validation[i].start + validation[i].length)];
			}
		}
		return result;
	}
}
import { Component, OnInit, ViewChild, Input, AfterViewInit, OnChanges } from '@angular/core';
import { ModalComponent } from "ng2-bs3-modal/components/modal";
import { isNullOrUndefined } from "util";
import { Observable } from "rxjs";
import { TranscriptionService } from "../../service/transcription.service";
import { SubscriptionManager } from "../../shared/SubscriptionManager";

declare var videojs: any;

@Component({
	selector   : 'app-transcr-guidelines',
	templateUrl: './transcr-guidelines.component.html',
	styleUrls  : [ './transcr-guidelines.component.css' ]
})
export class TranscrGuidelinesComponent implements OnInit, AfterViewInit, OnChanges {
	@ViewChild('modal_guidelines') modal_guidelines: ModalComponent;

	@Input() guidelines = null;

	private subscrmanager: SubscriptionManager = new SubscriptionManager();
	private collapsed: any[][] = [];
	private entries: number = 0;

	private counter = 0;
	private video_players: any[] = [];

	constructor(private transcrService: TranscriptionService) {
		this.subscrmanager.add(
			transcrService.guidelinesloaded.subscribe(
				(guidelines) => {
					this.entries = 0;
					this.guidelines = guidelines;

					for (let i = 0; i < guidelines.instructions.length; i++) {
						this.entries += guidelines.instructions[ i ].entries.length;
					}
					this.unCollapseAll();
				}
			)
		);
	}

	get visible(): boolean {
		return this.modal_guidelines.visible;
	}

	ngOnInit() {
	}

	ngAfterViewInit() {

	}

	ngOnChanges($event) {
		if (!isNullOrUndefined($event.guidelines.previousValue)) {
			setTimeout(() => {
				for (let g = 0; g < this.guidelines.instructions.length; g++) {
					for (let i = 0; i < this.guidelines.instructions[ g ].entries.length; i++) {
						for (let e = 0; e < this.guidelines.instructions[ g ].entries[ i ].examples.length; e++) {
							let id_v = "my-player_g" + g + "i" + i + "e" + e;
							if (document.getElementById(id_v)) {

								let old_player = this.videoplayerExists(id_v);

								if (old_player > -1) {
								}
								else {
									console.log("init " + id_v);
									let player = videojs(id_v, {
										"fluid"   : true,
										"autoplay": false,
										"preload" : "auto"
									}, function onPlayerReady() {
									});

									this.video_players.push(player);
								}
							}
						}
					}
				}
			}, 1000);
		}
	}

	public open() {
		this.modal_guidelines.open();
	}

	public close() {
		this.modal_guidelines.dismiss();
	}

	private unCollapseAll() {
		this.collapsed = [];

		for (let i = 0; i < this.guidelines.instructions.length; i++) {
			let elem = [];
			for (let j = 0; j < this.guidelines.instructions[ i ].entries.length; j++) {
				elem.push(true);
			}
			this.collapsed.push(elem);
		}
	}

	private toggle(group: number, entry: number) {
		this.collapsed[ group ][ entry ] = !this.collapsed[ group ][ entry ];
	}

	videoplayerExists(player: string): number {
		for (let i = 0; i < this.video_players.length; i++) {
			if (this.video_players[ i ].id_ == player) {
				return i;
			}
		}
		return -1;
	}
}

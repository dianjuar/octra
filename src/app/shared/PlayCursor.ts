import { AudioTime } from "./AudioTime";
import { Functions } from "./Functions";
import { AudioTimeCalculator } from "./AudioTimeCalculator";
import { Chunk } from "./Chunk";
import { Logger } from "./Logger";
export class PlayCursor {

	get absX(): number {
		return this._absX;
	}

	get time_pos(): AudioTime {
		return this._time_pos;
	}

	get relX(): number {
		//TODO INCORRECT
		return (this._innerWidth > 0) ? (this._absX % this._innerWidth) : 0;
	}

	public changeAbsX(absx: number, audioTCalculator: AudioTimeCalculator, audio_px_width: number, chunk: Chunk) {
		this._absX = Math.max(0, Math.min(absx, audio_px_width));
		this._time_pos.samples = audioTCalculator.absXChunktoSamples(absx, chunk);
	}

	public changeSamples(samples: number, audioTCalculator: AudioTimeCalculator, chunk?: Chunk) {
		this._time_pos.samples = samples;
		let duration = (chunk != null && chunk.time.start.samples < chunk.time.end.samples)
			? new AudioTime(chunk.time.end.samples - chunk.time.start.samples, audioTCalculator.samplerate) : null;

		let chunk_s = ((chunk) ? (chunk.time.start.samples) : 0);
		this._absX = audioTCalculator.samplestoAbsX(samples - chunk_s, duration);
	}

	private _absX: number;
	private _time_pos: AudioTime;
	private _innerWidth: number;

	constructor(absX: number, time_pos: AudioTime, innerWidth: number) {
		this._absX = absX;
		this._time_pos = time_pos;
		this._innerWidth = innerWidth;
	}
}
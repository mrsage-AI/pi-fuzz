/**
 * fuzz - dim out the screen during long sessions to rest your eyes.
 *
 * /fuzz covers the whole terminal with a low-contrast noise field and a small
 * status panel (agent status, model, context %, time fuzzed, clock). The agent
 * keeps running underneath. Press any key to unfuzz.
 *
 * Auto-loaded from ~/.pi/agent/extensions/
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";

const TICK_MS = 1000;
const NOISE_DENSITY = 0.07; // fraction of cells that get a speck
const NOISE_CHARS = ["·", "·", "·", "░", "∙", "⋅"];

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const noiseColor = (s: string) => `${ESC}2m${ESC}38;5;237m${s}${RESET}`;
const frame = (s: string) => `${ESC}38;5;240m${s}${RESET}`;
const label = (s: string) => `${ESC}38;5;243m${s}${RESET}`;
const value = (s: string) => `${ESC}38;5;250m${s}${RESET}`;
const accent = (s: string) => `${ESC}38;5;109m${s}${RESET}`;
const pulseOn = (s: string) => `${ESC}38;5;114m${s}${RESET}`;
const pulseOff = (s: string) => `${ESC}38;5;238m${s}${RESET}`;

function formatDuration(ms: number): string {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function clock(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

class FuzzComponent implements Component {
	private tui: TUI;
	private ctx: ExtensionCommandContext;
	private onClose: () => void;
	private startedAt = Date.now();
	private tick = 0;
	private interval: ReturnType<typeof setInterval> | null = null;
	private noise: string[] = [];
	private noiseWidth = 0;
	private noiseHeight = 0;

	constructor(tui: TUI, ctx: ExtensionCommandContext, onClose: () => void) {
		this.tui = tui;
		this.ctx = ctx;
		this.onClose = onClose;
		this.interval = setInterval(() => {
			this.tick++;
			this.tui.requestRender();
		}, TICK_MS);
	}

	handleInput(_data: string): void {
		// Any key unfuzzes.
		this.dispose();
		this.onClose();
	}

	invalidate(): void {
		this.noiseWidth = 0;
	}

	private buildNoise(width: number, height: number): void {
		if (width === this.noiseWidth && height === this.noiseHeight) return;
		this.noise = [];
		for (let y = 0; y < height; y++) {
			let row = "";
			for (let x = 0; x < width; x++) {
				row +=
					Math.random() < NOISE_DENSITY
						? NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]
						: " ";
			}
			this.noise.push(noiseColor(row));
		}
		this.noiseWidth = width;
		this.noiseHeight = height;
	}

	private panelLines(): string[] {
		const idle = this.ctx.isIdle();
		const pulse = this.tick % 2 === 0 ? pulseOn("●") : pulseOff("●");
		const status = idle ? label("idle") : `${pulse} ${accent("working")}`;

		const model = this.ctx.model?.id ?? "—";
		const usage = this.ctx.getContextUsage();
		const context =
			usage?.percent != null
				? `${Math.round(usage.percent)}%`
				: usage?.tokens != null
					? `${usage.tokens} tok`
					: "—";

		const rows: [string, string][] = [
			["status", status],
			["model", value(model)],
			["context", value(context)],
			["fuzzed", value(formatDuration(Date.now() - this.startedAt))],
			["clock", value(clock())],
		];

		const labelW = Math.max(...rows.map(([k]) => k.length));
		const body = rows.map(([k, v]) => `${label(k.padStart(labelW))}  ${v}`);
		const hint = label("press any key to unfuzz");

		const innerW = Math.max(...body.map(visibleWidth), visibleWidth(hint)) + 4;
		const pad = (s: string) => {
			const fill = Math.max(0, innerW - visibleWidth(s));
			return `${frame("│")}  ${s}${" ".repeat(fill - 2)}${frame("│")}`;
		};

		const title = ` ${accent("fuzz")} `;
		const titleFill = Math.max(0, innerW - visibleWidth(title));
		const top = frame("╭─") + title + frame("─".repeat(titleFill - 1) + "╮");
		const bottom = frame(`╰${"─".repeat(innerW)}╯`);

		return [top, pad(""), ...body.map(pad), pad(""), pad(hint), pad(""), bottom];
	}

	render(width: number): string[] {
		const height = Math.max(1, this.tui.terminal.rows);
		this.buildNoise(width, height);

		const lines = [...this.noise];
		const panel = this.panelLines();
		const panelW = Math.max(...panel.map(visibleWidth));
		const top = Math.max(0, Math.floor((height - panel.length) / 2));
		const left = Math.max(0, Math.floor((width - panelW) / 2));

		for (let i = 0; i < panel.length && top + i < height; i++) {
			const line = panel[i];
			const right = Math.max(0, width - left - visibleWidth(line));
			lines[top + i] =
				noiseColor(" ".repeat(left)) + line + noiseColor(" ".repeat(right));
		}
		return lines;
	}

	dispose(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("fuzz", {
		description: "Fuzz out the screen to rest your eyes; any key unfuzzes",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("fuzz requires interactive mode", "error");
				return;
			}
			await ctx.ui.custom(
				(tui, _theme, _kb, done) => new FuzzComponent(tui, ctx, () => done(undefined)),
				{
					overlay: true,
					overlayOptions: {
						width: "100%",
						maxHeight: "100%",
						row: 0,
						col: 0,
						margin: 0,
					},
				},
			);
		},
	});
}

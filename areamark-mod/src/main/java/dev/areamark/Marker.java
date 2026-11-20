package dev.areamark;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;

/**
 * Marking mode (key G): left click sets corner 1, right click corner 2, G again saves.
 * Clicks in marking mode never break or place anything. Reaches 64 blocks far.
 */
public final class Marker {
	public static final double RANGE = 64;

	private static boolean active;
	private static BlockPos pos1;
	private static BlockPos pos2;
	private static long pos1At;
	private static long pos2At;
	private static long activatedAt;

	private Marker() {
	}

	public static boolean active() {
		return active;
	}

	public static BlockPos pos1() {
		return pos1;
	}

	public static BlockPos pos2() {
		return pos2;
	}

	public static long pos1At() {
		return pos1At;
	}

	public static long pos2At() {
		return pos2At;
	}

	public static long activatedAt() {
		return activatedAt;
	}

	/** G: enter marking mode, or save the selection, or leave if nothing is selected. */
	public static void toggle(MinecraftClient mc) {
		if (!active) {
			active = true;
			activatedAt = Util.getMeasuringTimeMs();
			pos1 = pos2 = null;
			sound(mc, 1.4f);
			return;
		}
		if (pos1 != null) {
			Area area = AreaStore.add(pos1, pos2 == null ? pos1 : pos2);
			if (mc.player != null) {
				mc.player.sendMessage(Text.translatable("areamark.msg.saved", area.name, area.sizeText()), true);
			}
			mc.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.BLOCK_AMETHYST_BLOCK_CHIME, 1.3f, 0.9f));
		} else {
			sound(mc, 0.9f);
		}
		active = false;
		pos1 = pos2 = null;
	}

	public static void cancel() {
		active = false;
		pos1 = pos2 = null;
	}

	/** The block under the crosshair, up to 64 blocks away. */
	public static BlockPos target(MinecraftClient mc, float delta) {
		if (mc.player == null) {
			return null;
		}
		HitResult hit = mc.player.raycast(RANGE, delta, false);
		return hit instanceof BlockHitResult bh && hit.getType() == HitResult.Type.BLOCK ? bh.getBlockPos() : null;
	}

	/** @return true if the click was used (vanilla must not attack / break). */
	public static boolean leftClick(MinecraftClient mc) {
		if (!active) {
			return false;
		}
		BlockPos t = target(mc, 1.0f);
		if (t != null && !t.equals(pos1)) {
			pos1 = t;
			pos1At = Util.getMeasuringTimeMs();
			sound(mc, 1.6f);
		}
		return true;
	}

	public static boolean rightClick(MinecraftClient mc) {
		if (!active) {
			return false;
		}
		BlockPos t = target(mc, 1.0f);
		if (t != null && !t.equals(pos2)) {
			if (pos1 == null) {
				pos1 = t;
				pos1At = Util.getMeasuringTimeMs();
			} else {
				pos2 = t;
				pos2At = Util.getMeasuringTimeMs();
			}
			sound(mc, 1.8f);
		}
		return true;
	}

	private static void sound(MinecraftClient mc, float pitch) {
		mc.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.UI_BUTTON_CLICK.value(), pitch, 0.3f));
	}
}

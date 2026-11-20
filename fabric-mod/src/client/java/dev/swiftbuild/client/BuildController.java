package dev.swiftbuild.client;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.Modifiers;
import dev.swiftbuild.build.Palette;
import dev.swiftbuild.build.ShapeGenerator;
import dev.swiftbuild.build.ShapeResult;
import dev.swiftbuild.net.BuildRequestPayload;
import dev.swiftbuild.net.HelloPayload;
import dev.swiftbuild.net.UndoPayload;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemPlacementContext;
import net.minecraft.item.ItemStack;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.EntityHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Client side of building: turns clicks into points, computes the live preview and sends the
 * finished request to the server. Points after the first one are picked by intersecting the
 * view ray with a line or plane through the previous point, so shapes can extend into the air.
 */
public final class BuildController {
	public static boolean serverSupported;
	public static HelloPayload limits = new HelloPayload(96, 10, 10000, 1024);

	private static BuildAction action;
	private static final List<BlockPos> points = new ArrayList<>();
	private static Direction side = Direction.UP;
	private static float hitX = 0.5f, hitY = 0.5f, hitZ = 0.5f;
	private static Direction pendingSide = Direction.UP;
	private static float pendingX = 0.5f, pendingY = 0.5f, pendingZ = 0.5f;
	private static long seed = ThreadLocalRandom.current().nextLong();
	private static boolean useHeld;
	private static int useHeldTicks;

	private static Object previewKey;
	private static Preview previewCache;

	/** A computed preview: positions plus, for placing, the block state shown at each one. */
	public record Preview(BuildAction action, List<BlockPos> points, List<BlockPos> positions, List<BlockState> states, boolean truncated) {
	}

	private BuildController() {
	}

	private static ClientConfig cfg() {
		return ClientConfig.get();
	}

	public static BuildAction action() {
		return action;
	}

	public static int step() {
		return points.size();
	}

	public static boolean placeActive() {
		BuildMode mode = cfg().mode;
		return serverSupported && mode != BuildMode.VANILLA && (mode != BuildMode.SINGLE || cfg().modifiers.any() || cfg().mix);
	}

	public static boolean breakActive() {
		BuildMode mode = cfg().mode;
		return serverSupported && mode != BuildMode.VANILLA && (mode != BuildMode.SINGLE || cfg().modifiers.any());
	}

	public static void cancel() {
		action = null;
		points.clear();
		previewKey = null;
	}

	public static void onModeChanged() {
		cancel();
		ClientConfig.save();
	}

	public static void undo(boolean redo) {
		if (serverSupported) {
			ClientPlayNetworking.send(new UndoPayload(redo));
		}
	}

	// ------------------------------------------------------------------ input

	/** Called from the mixin before vanilla right-click handling. Returns true to cancel vanilla. */
	public static boolean onUse(MinecraftClient mc) {
		ClientPlayerEntity player = mc.player;
		if (player == null || !placeActive()) {
			return false;
		}
		if (action == BuildAction.BREAK) {
			cancel();
			click();
			useHeld = true;
			return true;
		}
		if (mc.crosshairTarget instanceof EntityHitResult || (player.isSneaking() && points.isEmpty()) || palette(player).isEmpty()) {
			return false;
		}
		if (useHeld) {
			// Holding the button repeats single-click shapes like vanilla does, but never multi-click ones.
			if (cfg().mode.clicks == 1 && ++useHeldTicks % 4 == 0) {
				clickAt(mc, BuildAction.PLACE);
			}
			return true;
		}
		useHeld = true;
		useHeldTicks = 0;
		clickAt(mc, BuildAction.PLACE);
		return true;
	}

	/** Called from the mixin before vanilla left-click handling. Returns true to cancel vanilla. */
	public static boolean onAttack(MinecraftClient mc) {
		ClientPlayerEntity player = mc.player;
		if (player == null || !breakActive()) {
			return false;
		}
		if (action == BuildAction.PLACE) {
			cancel();
			click();
			return true;
		}
		if (mc.crosshairTarget instanceof EntityHitResult || (player.isSneaking() && points.isEmpty())) {
			return false;
		}
		clickAt(mc, BuildAction.BREAK);
		return true;
	}

	/** Stops vanilla's hold-to-mine while shape-breaking is active. */
	public static boolean suppressMining(MinecraftClient mc) {
		if (mc.player == null || !breakActive() || mc.crosshairTarget instanceof EntityHitResult) {
			return false;
		}
		return action != null || !mc.player.isSneaking();
	}

	public static void tick(MinecraftClient mc) {
		if (!mc.options.useKey.isPressed()) {
			useHeld = false;
		}
		if (mc.player == null) {
			cancel();
		}
	}

	private static void clickAt(MinecraftClient mc, BuildAction act) {
		if (action != null && action != act) {
			cancel();
			return;
		}
		float delta = mc.getRenderTickCounter().getTickProgress(true);
		BlockPos p = pick(mc, act, delta, true);
		if (p == null) {
			return;
		}
		if (points.isEmpty()) {
			action = act;
		}
		points.add(p);
		click();
		if (points.size() >= cfg().mode.clicks) {
			ClientPlayNetworking.send(new BuildRequestPayload(action, cfg().mode, cfg().fill, List.copyOf(points), side, hitX, hitY, hitZ,
				cfg().modifiers, cfg().mix && action == BuildAction.PLACE, seed));
			seed = ThreadLocalRandom.current().nextLong();
			cancel();
		}
	}

	private static void click() {
		MinecraftClient.getInstance().getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.UI_BUTTON_CLICK.value(), 1.6f + 0.15f * points.size(), 0.18f));
	}

	// ------------------------------------------------------------------ picking

	private static double reach(ClientPlayerEntity player) {
		return player.isCreative() ? limits.reachCreative() : limits.reachSurvival();
	}

	/**
	 * Picks the next point. For the first point a normal ray cast is used; later points are found
	 * on a line or plane through the previous point.
	 */
	private static BlockPos pick(MinecraftClient mc, BuildAction act, float delta, boolean commit) {
		ClientPlayerEntity player = mc.player;
		ClientWorld world = mc.world;
		if (player == null || world == null) {
			return null;
		}
		double reach = reach(player);
		if (points.isEmpty()) {
			HitResult hit = player.raycast(reach, delta, false);
			if (!(hit instanceof BlockHitResult bh) || hit.getType() != HitResult.Type.BLOCK) {
				return null;
			}
			BlockPos target = bh.getBlockPos();
			if (act == BuildAction.PLACE && !world.getBlockState(target).isReplaceable()) {
				target = target.offset(bh.getSide());
			}
			Vec3d h = bh.getPos();
			pendingSide = bh.getSide();
			pendingX = MathHelper.clamp((float) (h.x - target.getX()), 0f, 1f);
			pendingY = MathHelper.clamp((float) (h.y - target.getY()), 0f, 1f);
			pendingZ = MathHelper.clamp((float) (h.z - target.getZ()), 0f, 1f);
			if (commit) {
				side = pendingSide;
				hitX = pendingX;
				hitY = pendingY;
				hitZ = pendingZ;
			}
			return target;
		}
		Vec3d origin = player.getCameraPosVec(delta);
		Vec3d dir = player.getRotationVec(delta);
		BlockPos first = points.get(0);
		BlockPos last = points.get(points.size() - 1);
		BuildMode mode = cfg().mode;
		int stepIndex = points.size();
		Vec3d result = switch (mode) {
			case LINE -> axisLine(origin, dir, Vec3d.ofCenter(first), reach);
			case WALL -> wallPlane(origin, dir, Vec3d.ofCenter(first), reach);
			case CUBE, CYLINDER -> stepIndex == 1 ? floorPlane(origin, dir, Vec3d.ofCenter(first), reach) : height(origin, dir, Vec3d.ofCenter(last), reach);
			default -> floorPlane(origin, dir, Vec3d.ofCenter(first), reach);
		};
		if (result == null || result.squaredDistanceTo(origin) > reach * reach * 4) {
			return null;
		}
		BlockPos pos = BlockPos.ofFloored(result);
		// Keep the constrained coordinates exact, rounding noise must not move the plane.
		return switch (mode) {
			case CUBE, CYLINDER -> stepIndex == 1 ? new BlockPos(pos.getX(), first.getY(), pos.getZ()) : new BlockPos(last.getX(), pos.getY(), last.getZ());
			case LINE, WALL -> pos;
			default -> new BlockPos(pos.getX(), first.getY(), pos.getZ());
		};
	}

	private static Vec3d floorPlane(Vec3d o, Vec3d d, Vec3d c, double reach) {
		if (Math.abs(d.y) < 1e-4) {
			return null;
		}
		double t = (c.y - o.y) / d.y;
		if (t <= 0 || t > reach * 2) {
			return null;
		}
		return o.add(d.multiply(t));
	}

	private static Vec3d wallPlane(Vec3d o, Vec3d d, Vec3d c, double reach) {
		// Use the vertical plane that faces the player most directly.
		boolean xPlane = Math.abs(d.x) > Math.abs(d.z);
		Vec3d hit = planeHit(o, d, c, xPlane, reach);
		if (hit == null) {
			hit = planeHit(o, d, c, !xPlane, reach);
		}
		return hit;
	}

	private static Vec3d planeHit(Vec3d o, Vec3d d, Vec3d c, boolean xPlane, double reach) {
		double dc = xPlane ? d.x : d.z;
		if (Math.abs(dc) < 1e-4) {
			return null;
		}
		double t = ((xPlane ? c.x : c.z) - (xPlane ? o.x : o.z)) / dc;
		if (t <= 0 || t > reach * 2) {
			return null;
		}
		Vec3d hit = o.add(d.multiply(t));
		return xPlane ? new Vec3d(c.x, hit.y, hit.z) : new Vec3d(hit.x, hit.y, c.z);
	}

	private static Vec3d axisLine(Vec3d o, Vec3d d, Vec3d c, double reach) {
		Vec3d best = null;
		double bestDist = Double.MAX_VALUE;
		for (Direction.Axis axis : Direction.Axis.values()) {
			Vec3d u = new Vec3d(axis == Direction.Axis.X ? 1 : 0, axis == Direction.Axis.Y ? 1 : 0, axis == Direction.Axis.Z ? 1 : 0);
			double[] st = closest(o, d, c, u);
			if (st == null || st[0] <= 0) {
				continue;
			}
			Vec3d onLine = c.add(u.multiply(st[1]));
			double dist = onLine.distanceTo(o.add(d.multiply(st[0])));
			// Prefer lines that are actually close to where the player looks, normalised by distance.
			double score = dist / Math.max(1.0, st[0]);
			if (score < bestDist && Math.abs(st[1]) <= reach * 2) {
				bestDist = score;
				best = onLine;
			}
		}
		return best;
	}

	private static Vec3d height(Vec3d o, Vec3d d, Vec3d c, double reach) {
		double[] st = closest(o, d, c, new Vec3d(0, 1, 0));
		if (st == null || st[0] <= 0) {
			return null;
		}
		return new Vec3d(c.x, c.y + MathHelper.clamp(st[1], -reach * 2, reach * 2), c.z);
	}

	/** Closest approach between ray o + t·d and line c + s·u. Returns {t, s} or null if parallel. */
	private static double[] closest(Vec3d o, Vec3d d, Vec3d c, Vec3d u) {
		Vec3d w = o.subtract(c);
		double a = d.dotProduct(d);
		double b = d.dotProduct(u);
		double cc = u.dotProduct(u);
		double dd = d.dotProduct(w);
		double e = u.dotProduct(w);
		double denom = a * cc - b * b;
		if (Math.abs(denom) < 1e-6) {
			return null;
		}
		return new double[] {(b * e - cc * dd) / denom, (a * e - b * dd) / denom};
	}

	// ------------------------------------------------------------------ preview

	public static List<ItemStack> palette(ClientPlayerEntity player) {
		List<ItemStack> list = new ArrayList<>();
		if (cfg().mix) {
			for (int slot = 0; slot < 9; slot++) {
				ItemStack stack = player.getInventory().getStack(slot);
				if (stack.getItem() instanceof BlockItem) {
					list.add(stack);
				}
			}
		} else if (player.getMainHandStack().getItem() instanceof BlockItem) {
			list.add(player.getMainHandStack());
		}
		return list;
	}

	public static Preview preview(MinecraftClient mc, float delta) {
		ClientPlayerEntity player = mc.player;
		if (player == null || mc.world == null) {
			return null;
		}
		BuildAction act = action;
		if (act == null) {
			if (!placeActive() || player.isSneaking() || palette(player).isEmpty() || mc.crosshairTarget instanceof EntityHitResult) {
				return null;
			}
			act = BuildAction.PLACE;
		}
		List<BlockPos> pts = new ArrayList<>(points);
		BlockPos next = pick(mc, act, delta, false);
		if (next != null && pts.size() < Math.max(1, cfg().mode.clicks)) {
			pts.add(next);
		}
		if (pts.isEmpty()) {
			return null;
		}
		List<ItemStack> palette = act == BuildAction.PLACE ? palette(player) : List.of();
		boolean fresh = points.isEmpty();
		Direction s = fresh ? pendingSide : side;
		float hx = fresh ? pendingX : hitX;
		float hy = fresh ? pendingY : hitY;
		float hz = fresh ? pendingZ : hitZ;
		Object key = List.of(act, cfg().mode, cfg().fill, cfg().modifiers, cfg().mix, pts, seed, palette.stream().map(ItemStack::getItem).toList(),
			player.getHorizontalFacing(), s, (int) (player.getPitch() / 30), hx > 0.5f, hy > 0.5f, hz > 0.5f);
		if (Objects.equals(key, previewKey) && previewCache != null) {
			return previewCache;
		}
		int limit = player.isCreative() ? limits.maxBlocksCreative() : limits.maxBlocksSurvival();
		ShapeResult shape = ShapeGenerator.generate(cfg().mode, cfg().fill, pts, cfg().modifiers, limit);
		List<BlockPos> positions = new ArrayList<>(shape.positions());
		ShapeGenerator.sortFrom(positions, pts.get(0));
		List<BlockState> states = new ArrayList<>();
		if (act == BuildAction.PLACE) {
			List<BlockPos> placeable = new ArrayList<>();
			for (BlockPos pos : positions) {
				ItemStack stack = palette.get(Palette.pick(seed, pos, palette.size()));
				BlockHitResult hit = new BlockHitResult(new Vec3d(pos.getX() + hx, pos.getY() + hy, pos.getZ() + hz), s, pos, false);
				ItemPlacementContext ctx = new ItemPlacementContext(mc.world, player, Hand.MAIN_HAND, stack.copyWithCount(1), hit);
				if (!ctx.canReplaceExisting()) {
					continue;
				}
				BlockState state = ((BlockItem) stack.getItem()).getBlock().getPlacementState(ctx);
				if (state != null) {
					placeable.add(pos);
					states.add(state);
				}
			}
			positions = placeable;
		} else {
			positions.removeIf(pos -> mc.world.getBlockState(pos).isAir());
		}
		previewKey = key;
		previewCache = new Preview(act, pts, positions, states, shape.truncated());
		return previewCache;
	}

	public static Modifiers modifiers() {
		return cfg().modifiers;
	}
}

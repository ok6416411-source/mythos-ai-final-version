package dev.swiftbuild.server;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.Palette;
import dev.swiftbuild.build.ShapeGenerator;
import dev.swiftbuild.build.ShapeResult;
import dev.swiftbuild.net.AnimationPayload;
import dev.swiftbuild.net.BuildRequestPayload;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.FluidBlock;
import net.minecraft.block.ShapeContext;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.item.ItemPlacementContext;
import net.minecraft.item.ItemStack;
import net.minecraft.network.packet.s2c.play.WorldEventS2CPacket;
import net.minecraft.registry.RegistryKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.BlockSoundGroup;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import net.minecraft.world.WorldEvents;

/**
 * Server-authoritative building: validates a request, recomputes the shape, takes items in
 * survival, and schedules every block change with a small delay so the build ripples outward
 * (the client plays a matching grow / shrink animation). Also keeps per-player undo history.
 */
public final class BuildService {
	private static final int MAIN_SLOTS = 36;
	private static final int OFFHAND_SLOT = 40;
	private static final int MAX_BREAK_EFFECTS_PER_TICK = 24;

	private enum Kind { PLACE, REMOVE, BREAK_SURVIVAL }

	private record Change(BlockPos pos, BlockState before, BlockState after) {
	}

	private record Operation(RegistryKey<World> world, List<Change> changes) {
	}

	private static final class History {
		final Deque<Operation> undo = new ArrayDeque<>();
		final Deque<Operation> redo = new ArrayDeque<>();
	}

	private static final class Task {
		final ServerWorld world;
		final BlockPos pos;
		final BlockState expected;
		final BlockState target;
		final Kind kind;
		final UUID player;
		/** Stack used for {@code onPlaced} (place) or given back if the change fails / is undone. */
		final ItemStack stack;
		final boolean refundOnSuccess;

		Task(ServerWorld world, BlockPos pos, BlockState expected, BlockState target, Kind kind, UUID player, ItemStack stack, boolean refundOnSuccess) {
			this.world = world;
			this.pos = pos;
			this.expected = expected;
			this.target = target;
			this.kind = kind;
			this.player = player;
			this.stack = stack;
			this.refundOnSuccess = refundOnSuccess;
		}
	}

	private static final TreeMap<Long, List<Task>> QUEUE = new TreeMap<>();
	private static final Map<RegistryKey<World>, Set<BlockPos>> RESERVED = new HashMap<>();
	private static final Map<UUID, Integer> PENDING = new HashMap<>();
	private static final Map<UUID, History> HISTORY = new HashMap<>();
	private static final Map<UUID, Long> LAST_REQUEST = new HashMap<>();

	private BuildService() {
	}

	// ------------------------------------------------------------------ requests

	public static void handleBuild(ServerPlayerEntity player, BuildRequestPayload req) {
		ServerConfig c = ServerConfig.get();
		MinecraftServer server = player.getEntityWorld().getServer();
		long now = server.getTicks();
		if (player.isSpectator() || !player.canModifyBlocks() || req.mode() == BuildMode.VANILLA || req.points().size() != req.mode().clicks) {
			return;
		}
		Long last = LAST_REQUEST.get(player.getUuid());
		if (last != null && now - last < 2) {
			return;
		}
		LAST_REQUEST.put(player.getUuid(), now);

		boolean creative = player.isCreative();
		int limit = creative ? c.maxBlocksCreative : c.maxBlocksSurvival;
		if (PENDING.getOrDefault(player.getUuid(), 0) > limit * 2) {
			player.sendMessage(Text.translatable("swiftbuild.msg.busy"), true);
			return;
		}
		double reach = (creative ? c.reachCreative : c.reachSurvival) + 2.0;
		Vec3d eye = player.getEyePos();
		for (BlockPos p : req.points()) {
			if (eye.squaredDistanceTo(Vec3d.ofCenter(p)) > reach * reach) {
				player.sendMessage(Text.translatable("swiftbuild.msg.too_far"), true);
				return;
			}
		}

		ShapeResult shape = ShapeGenerator.generate(req.mode(), req.fill(), req.points(), req.modifiers(), limit);
		if (shape.truncated()) {
			player.sendMessage(Text.translatable("swiftbuild.msg.limit", limit), true);
		}
		List<BlockPos> positions = new ArrayList<>(shape.positions());
		ShapeGenerator.sortFrom(positions, req.points().get(0));
		double maxDistance = creative ? 320 : reach * 3;

		if (req.action() == BuildAction.PLACE) {
			place(player, req, positions, maxDistance, creative, now);
		} else {
			breakBlocks(player, req, positions, maxDistance, creative, now);
		}
	}

	private static boolean usable(ServerPlayerEntity player, ServerWorld world, BlockPos pos, double maxDistance) {
		return world.isInBuildLimit(pos)
			&& world.isChunkLoaded(pos.getX() >> 4, pos.getZ() >> 4)
			&& player.getEyePos().squaredDistanceTo(Vec3d.ofCenter(pos)) <= maxDistance * maxDistance
			&& player.canModifyAt(world, pos)
			&& !reserved(world).contains(pos);
	}

	private static void place(ServerPlayerEntity player, BuildRequestPayload req, List<BlockPos> positions, double maxDistance, boolean creative, long now) {
		ServerWorld world = player.getEntityWorld();
		List<ItemStack> palette = new ArrayList<>();
		List<Integer> paletteSlots = new ArrayList<>();
		if (req.mix()) {
			for (int slot = 0; slot < 9; slot++) {
				ItemStack stack = player.getInventory().getStack(slot);
				if (stack.getItem() instanceof BlockItem) {
					palette.add(stack.copyWithCount(1));
					paletteSlots.add(slot);
				}
			}
		} else {
			ItemStack held = player.getMainHandStack();
			if (held.getItem() instanceof BlockItem) {
				palette.add(held.copyWithCount(1));
				paletteSlots.add(player.getInventory().getSelectedSlot());
			}
		}
		if (palette.isEmpty()) {
			return;
		}

		int[] available = new int[palette.size()];
		int[] used = new int[palette.size()];
		if (!creative) {
			for (int i = 0; i < palette.size(); i++) {
				available[i] = count(player, palette.get(i));
				// Several hotbar slots can hold the same block; they share one pool.
				for (int j = 0; j < i; j++) {
					if (ItemStack.areItemsAndComponentsEqual(palette.get(i), palette.get(j))) {
						available[i] = 0;
						break;
					}
				}
			}
		}

		List<Change> changes = new ArrayList<>();
		List<Task> tasks = new ArrayList<>();
		for (BlockPos pos : positions) {
			if (!usable(player, world, pos, maxDistance)) {
				continue;
			}
			int index = Palette.pick(req.seed(), pos, palette.size());
			int pool = creative ? index : poolIndex(palette, index);
			if (!creative && used[pool] >= available[pool]) {
				continue;
			}
			ItemStack template = palette.get(index);
			BlockHitResult hit = new BlockHitResult(
				new Vec3d(pos.getX() + req.hitX(), pos.getY() + req.hitY(), pos.getZ() + req.hitZ()), req.side(), pos, false);
			ItemPlacementContext ctx = new ItemPlacementContext(world, player, Hand.MAIN_HAND, template.copy(), hit);
			if (!ctx.canReplaceExisting() || !ctx.getBlockPos().equals(pos)) {
				continue;
			}
			BlockState state = ((BlockItem) template.getItem()).getBlock().getPlacementState(ctx);
			if (state == null || !state.canPlaceAt(world, pos) || !world.canPlace(state, pos, ShapeContext.of(player))) {
				continue;
			}
			BlockState before = world.getBlockState(pos);
			reserved(world).add(pos);
			used[pool]++;
			changes.add(new Change(pos, before, state));
			tasks.add(new Task(world, pos, before, state, Kind.PLACE, player.getUuid(), template, false));
		}
		if (tasks.isEmpty()) {
			return;
		}
		if (!creative) {
			for (int i = 0; i < palette.size(); i++) {
				if (used[i] > 0) {
					consume(player, palette.get(i), used[i], paletteSlots.get(i));
				}
			}
		}
		schedule(player, world, tasks, req.points().get(0), now, true);
		record(player, new Operation(world.getRegistryKey(), changes));
	}

	private static void breakBlocks(ServerPlayerEntity player, BuildRequestPayload req, List<BlockPos> positions, double maxDistance, boolean creative, long now) {
		if (!creative && !ServerConfig.get().allowSurvivalBreaking) {
			player.sendMessage(Text.translatable("swiftbuild.msg.no_survival_break"), true);
			return;
		}
		ServerWorld world = player.getEntityWorld();
		ItemStack tool = player.getMainHandStack();
		List<Change> changes = new ArrayList<>();
		List<Task> tasks = new ArrayList<>();
		for (BlockPos pos : positions) {
			if (!usable(player, world, pos, maxDistance)) {
				continue;
			}
			BlockState state = world.getBlockState(pos);
			if (state.isAir() || state.getBlock() instanceof FluidBlock) {
				continue;
			}
			float hardness = state.getHardness(world, pos);
			if (!creative && (hardness < 0 || !canBreakFast(tool, state, hardness))) {
				continue;
			}
			BlockState after = state.getFluidState().getBlockState();
			reserved(world).add(pos);
			changes.add(new Change(pos, state, after));
			tasks.add(new Task(world, pos, state, after, creative ? Kind.REMOVE : Kind.BREAK_SURVIVAL, player.getUuid(), ItemStack.EMPTY, false));
		}
		if (tasks.isEmpty()) {
			return;
		}
		schedule(player, world, tasks, req.points().get(0), now, false);
		record(player, new Operation(world.getRegistryKey(), changes));
	}

	/** Survival shape-breaking only works on soft blocks or with the right tool. */
	private static boolean canBreakFast(ItemStack tool, BlockState state, float hardness) {
		return hardness < 1.0f || tool.isSuitableFor(state);
	}

	public static void handleUndo(ServerPlayerEntity player, boolean redo) {
		History history = HISTORY.get(player.getUuid());
		Deque<Operation> from = history == null ? null : (redo ? history.redo : history.undo);
		if (from == null || from.isEmpty()) {
			player.sendMessage(Text.translatable(redo ? "swiftbuild.msg.nothing_redo" : "swiftbuild.msg.nothing_undo"), true);
			return;
		}
		ServerWorld world = player.getEntityWorld();
		Operation op = from.peekFirst();
		if (!op.world().equals(world.getRegistryKey())) {
			player.sendMessage(Text.translatable("swiftbuild.msg.other_dimension"), true);
			return;
		}
		from.pollFirst();
		boolean creative = player.isCreative();
		long now = world.getServer().getTicks();
		List<Task> grow = new ArrayList<>();
		List<Task> shrink = new ArrayList<>();
		Map<Item, Integer> stock = new HashMap<>();
		for (Change change : op.changes()) {
			BlockState source = redo ? change.before() : change.after();
			BlockState target = redo ? change.after() : change.before();
			BlockPos pos = change.pos();
			if (!world.isChunkLoaded(pos.getX() >> 4, pos.getZ() >> 4) || !world.getBlockState(pos).equals(source) || reserved(world).contains(pos)) {
				continue;
			}
			if (source.isReplaceable() && !target.isReplaceable()) {
				ItemStack stack = new ItemStack(target.getBlock().asItem());
				if (!creative) {
					Item item = stack.getItem();
					int left = stock.computeIfAbsent(item, i -> count(player, new ItemStack(i)));
					if (left <= 0 || stack.isEmpty()) {
						continue;
					}
					stock.put(item, left - 1);
					consume(player, stack, 1, -1);
				}
				reserved(world).add(pos);
				grow.add(new Task(world, pos, source, target, Kind.PLACE, player.getUuid(), stack, false));
			} else {
				ItemStack refund = creative || source.isReplaceable() ? ItemStack.EMPTY : new ItemStack(source.getBlock().asItem());
				reserved(world).add(pos);
				shrink.add(new Task(world, pos, source, target, Kind.REMOVE, player.getUuid(), refund, !refund.isEmpty()));
			}
		}
		BlockPos origin = op.changes().isEmpty() ? player.getBlockPos() : op.changes().get(0).pos();
		if (!shrink.isEmpty()) {
			schedule(player, world, shrink, origin, now, false);
		}
		if (!grow.isEmpty()) {
			schedule(player, world, grow, origin, now, true);
		}
		(redo ? history.undo : history.redo).addFirst(op);
		player.sendMessage(Text.translatable(redo ? "swiftbuild.msg.redone" : "swiftbuild.msg.undone", grow.size() + shrink.size()), true);
	}

	// ------------------------------------------------------------------ scheduling

	private static void schedule(ServerPlayerEntity player, ServerWorld world, List<Task> tasks, BlockPos origin, long now, boolean grow) {
		ServerConfig c = ServerConfig.get();
		int anim = c.animations ? Math.max(0, c.animationTicks) : 0;
		double maxDist = 0;
		for (Task t : tasks) {
			maxDist = Math.max(maxDist, Math.sqrt(t.pos.getSquaredDistance(origin)));
		}
		double perBlock = c.animations ? c.waveTicksPerBlock : 0;
		if (maxDist * perBlock > c.maxWaveTicks && maxDist > 0) {
			perBlock = c.maxWaveTicks / maxDist;
		}
		List<AnimationPayload.Entry> entries = new ArrayList<>();
		for (Task t : tasks) {
			int delay = (int) Math.round(Math.sqrt(t.pos.getSquaredDistance(origin)) * perBlock);
			long due = now + delay + (grow ? anim : 0);
			QUEUE.computeIfAbsent(due, k -> new ArrayList<>()).add(t);
			BlockState shown = grow ? t.target : t.expected;
			entries.add(new AnimationPayload.Entry(t.pos, Block.getRawIdFromState(shown), delay, grow ? AnimationPayload.GROW : AnimationPayload.SHRINK));
		}
		PENDING.merge(player.getUuid(), tasks.size(), Integer::sum);

		if (anim > 0 || perBlock > 0) {
			List<ServerPlayerEntity> viewers = new ArrayList<>(PlayerLookup.around(world, Vec3d.ofCenter(origin), 160));
			if (!viewers.contains(player)) {
				viewers.add(player);
			}
			for (int from = 0; from < entries.size(); from += AnimationPayload.MAX_ENTRIES) {
				AnimationPayload payload = new AnimationPayload(anim, new ArrayList<>(entries.subList(from, Math.min(entries.size(), from + AnimationPayload.MAX_ENTRIES))));
				for (ServerPlayerEntity viewer : viewers) {
					if (ServerPlayNetworking.canSend(viewer, AnimationPayload.ID)) {
						ServerPlayNetworking.send(viewer, payload);
					}
				}
			}
		}
	}

	public static void tick(MinecraftServer server) {
		long now = server.getTicks();
		int sounds = 0;
		int effects = 0;
		while (!QUEUE.isEmpty() && QUEUE.firstKey() <= now) {
			for (Task task : QUEUE.pollFirstEntry().getValue()) {
				int[] budget = run(server, task, sounds, effects);
				sounds = budget[0];
				effects = budget[1];
			}
		}
	}

	public static void flushAll(MinecraftServer server) {
		while (!QUEUE.isEmpty()) {
			for (Task task : QUEUE.pollFirstEntry().getValue()) {
				run(server, task, Integer.MAX_VALUE, Integer.MAX_VALUE);
			}
		}
		RESERVED.clear();
		PENDING.clear();
	}

	private static int[] run(MinecraftServer server, Task task, int sounds, int effects) {
		ServerWorld world = task.world;
		BlockPos pos = task.pos;
		reserved(world).remove(pos);
		PENDING.computeIfPresent(task.player, (k, v) -> v <= 1 ? null : v - 1);
		ServerPlayerEntity player = server.getPlayerManager().getPlayer(task.player);
		if (!world.isChunkLoaded(pos.getX() >> 4, pos.getZ() >> 4)) {
			refund(player, world, pos, task.stack, task.kind == Kind.PLACE);
			return new int[] {sounds, effects};
		}
		BlockState current = world.getBlockState(pos);
		switch (task.kind) {
			case PLACE -> {
				if ((!current.equals(task.expected) && !current.isReplaceable()) || !task.target.canPlaceAt(world, pos)) {
					refund(player, world, pos, task.stack, true);
					break;
				}
				world.setBlockState(pos, task.target, Block.NOTIFY_ALL);
				if (player != null && !task.stack.isEmpty() && player.getEntityWorld() == world) {
					task.target.getBlock().onPlaced(world, pos, task.target, player, task.stack);
				}
				if (sounds < ServerConfig.get().maxPlaceSoundsPerTick) {
					sounds++;
					BlockSoundGroup group = task.target.getSoundGroup();
					world.playSound(null, pos, group.getPlaceSound(), SoundCategory.BLOCKS, (group.getVolume() + 1.0f) / 2.0f, group.getPitch() * 0.8f);
				}
			}
			case REMOVE -> {
				if (!current.equals(task.expected)) {
					break;
				}
				world.setBlockState(pos, task.target, Block.NOTIFY_ALL);
				if (effects < MAX_BREAK_EFFECTS_PER_TICK) {
					effects++;
					world.syncWorldEvent(WorldEvents.BLOCK_BROKEN, pos, Block.getRawIdFromState(current));
				}
				if (task.refundOnSuccess) {
					refund(player, world, pos, task.stack, true);
				}
			}
			case BREAK_SURVIVAL -> {
				if (!current.equals(task.expected) || player == null || player.getEntityWorld() != world) {
					break;
				}
				float hardness = current.getHardness(world, pos);
				if (hardness < 0 || !canBreakFast(player.getMainHandStack(), current, hardness)) {
					break;
				}
				if (player.interactionManager.tryBreakBlock(pos) && effects < MAX_BREAK_EFFECTS_PER_TICK) {
					effects++;
					// Vanilla skips the breaking player (it assumes the client predicted the break).
					player.networkHandler.sendPacket(new WorldEventS2CPacket(WorldEvents.BLOCK_BROKEN, pos, Block.getRawIdFromState(current), false));
				}
			}
		}
		return new int[] {sounds, effects};
	}

	// ------------------------------------------------------------------ helpers

	private static Set<BlockPos> reserved(World world) {
		return RESERVED.computeIfAbsent(world.getRegistryKey(), k -> new HashSet<>());
	}

	private static void record(ServerPlayerEntity player, Operation op) {
		History history = HISTORY.computeIfAbsent(player.getUuid(), u -> new History());
		history.undo.addFirst(op);
		history.redo.clear();
		while (history.undo.size() > Math.max(1, ServerConfig.get().historySize)) {
			history.undo.pollLast();
		}
	}

	public static void forget(UUID player) {
		HISTORY.remove(player);
		LAST_REQUEST.remove(player);
	}

	private static int poolIndex(List<ItemStack> palette, int index) {
		for (int j = 0; j < index; j++) {
			if (ItemStack.areItemsAndComponentsEqual(palette.get(index), palette.get(j))) {
				return j;
			}
		}
		return index;
	}

	private static boolean isInventorySlot(int slot) {
		return slot < MAIN_SLOTS || slot == OFFHAND_SLOT;
	}

	private static int count(ServerPlayerEntity player, ItemStack template) {
		int total = 0;
		for (int slot = 0; slot < player.getInventory().size(); slot++) {
			ItemStack stack = player.getInventory().getStack(slot);
			if (isInventorySlot(slot) && ItemStack.areItemsAndComponentsEqual(stack, template)) {
				total += stack.getCount();
			}
		}
		return total;
	}

	private static void consume(ServerPlayerEntity player, ItemStack template, int amount, int preferredSlot) {
		if (preferredSlot >= 0) {
			amount = take(player, preferredSlot, template, amount);
		}
		for (int slot = 0; slot < player.getInventory().size() && amount > 0; slot++) {
			if (isInventorySlot(slot)) {
				amount = take(player, slot, template, amount);
			}
		}
		player.getInventory().markDirty();
	}

	private static int take(ServerPlayerEntity player, int slot, ItemStack template, int amount) {
		ItemStack stack = player.getInventory().getStack(slot);
		if (amount <= 0 || !ItemStack.areItemsAndComponentsEqual(stack, template)) {
			return amount;
		}
		int n = Math.min(amount, stack.getCount());
		stack.decrement(n);
		return amount - n;
	}

	private static void refund(ServerPlayerEntity player, ServerWorld world, BlockPos pos, ItemStack stack, boolean wanted) {
		if (!wanted || stack == null || stack.isEmpty() || (player != null && player.isCreative())) {
			return;
		}
		if (player != null) {
			player.getInventory().offerOrDrop(stack.copyWithCount(1));
		} else {
			Block.dropStack(world, pos, stack.copyWithCount(1));
		}
	}
}

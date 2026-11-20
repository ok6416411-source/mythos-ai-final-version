package dev.swiftbuild.client;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.client.render.AnimationManager;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;

/**
 * Client-only building for servers without SwiftBuild. Every block is placed with an ordinary
 * right click on a neighbouring block (the same packet vanilla sends), throttled to a few
 * blocks per tick and limited to the player's normal reach, so the server sees nothing unusual.
 * Breaking and undo work in creative only, because survival breaking takes time.
 */
public final class ClientOnlyBuilder {
	private static final int ANIM_TICKS = 4;
	private static final int MAX_ATTEMPTS = 12;
	private static final int HISTORY = 16;

	private record Job(BlockPos pos, BlockState state, boolean place, long due, int attempts) {
	}

	private static final Deque<Job> QUEUE = new ArrayDeque<>();
	private static final Deque<List<BlockPos>> UNDO = new ArrayDeque<>();
	private static List<BlockPos> current;
	private static long ticks;

	private ClientOnlyBuilder() {
	}

	public static boolean busy() {
		return !QUEUE.isEmpty();
	}

	public static int pending() {
		return QUEUE.size();
	}

	public static void clear() {
		QUEUE.clear();
		UNDO.clear();
		current = null;
	}

	/** Max blocks per action in client mode. */
	public static int limit() {
		return Math.max(1, ClientConfig.get().clientMaxBlocks);
	}

	/** A position is buildable if the server will accept a click there. */
	public static boolean inReach(ClientPlayerEntity player, BlockPos pos) {
		return player.canInteractWithBlockAt(pos, 0.0);
	}

	public static void submit(MinecraftClient mc, BuildAction action, List<BlockPos> positions, List<BlockState> states) {
		ClientPlayerEntity player = mc.player;
		if (player == null || positions.isEmpty()) {
			return;
		}
		if (action == BuildAction.BREAK && !player.isCreative()) {
			player.sendMessage(Text.translatable("swiftbuild.msg.client_break_creative"), true);
			return;
		}
		if (QUEUE.size() > limit() * 2) {
			player.sendMessage(Text.translatable("swiftbuild.msg.busy"), true);
			return;
		}
		int perTick = Math.max(1, ClientConfig.get().clientBlocksPerTick);
		long start = Math.max(ticks, QUEUE.isEmpty() ? ticks : QUEUE.peekLast().due()) + 1;
		current = new ArrayList<>();
		for (int i = 0; i < positions.size(); i++) {
			long due = start + i / perTick + (action == BuildAction.PLACE ? ANIM_TICKS : 0);
			BlockPos pos = positions.get(i);
			BlockState state = action == BuildAction.PLACE ? states.get(i) : mc.world.getBlockState(pos);
			QUEUE.addLast(new Job(pos, state, action == BuildAction.PLACE, due, 0));
			long animStart = due - (action == BuildAction.PLACE ? ANIM_TICKS : 0);
			AnimationManager.addLocal(pos, state, (animStart - ticks) * 50L, ANIM_TICKS * 50L, action == BuildAction.PLACE);
		}
		if (action == BuildAction.PLACE) {
			UNDO.addFirst(current);
			while (UNDO.size() > HISTORY) {
				UNDO.pollLast();
			}
		} else {
			current = null;
		}
	}

	public static void undo(MinecraftClient mc, boolean redo) {
		ClientPlayerEntity player = mc.player;
		if (player == null) {
			return;
		}
		if (redo) {
			player.sendMessage(Text.translatable("swiftbuild.msg.client_no_redo"), true);
			return;
		}
		if (!player.isCreative()) {
			player.sendMessage(Text.translatable("swiftbuild.msg.client_undo_creative"), true);
			return;
		}
		List<BlockPos> last = UNDO.pollFirst();
		if (last == null || last.isEmpty()) {
			player.sendMessage(Text.translatable("swiftbuild.msg.nothing_undo"), true);
			return;
		}
		List<BlockPos> reachable = new ArrayList<>();
		List<BlockState> states = new ArrayList<>();
		for (BlockPos pos : last) {
			if (inReach(player, pos) && !mc.world.getBlockState(pos).isReplaceable()) {
				reachable.add(pos);
				states.add(mc.world.getBlockState(pos));
			}
		}
		submit(mc, BuildAction.BREAK, reachable, states);
		player.sendMessage(Text.translatable("swiftbuild.msg.undone", reachable.size()), true);
	}

	public static void tick(MinecraftClient mc) {
		ticks++;
		ClientPlayerEntity player = mc.player;
		ClientWorld world = mc.world;
		if (player == null || world == null || mc.interactionManager == null) {
			QUEUE.clear();
			return;
		}
		int budget = Math.max(1, ClientConfig.get().clientBlocksPerTick);
		int originalSlot = player.getInventory().getSelectedSlot();
		List<Job> retry = new ArrayList<>();
		while (budget > 0 && !QUEUE.isEmpty() && QUEUE.peekFirst().due() <= ticks) {
			Job job = QUEUE.pollFirst();
			if (!inReach(player, job.pos())) {
				continue;
			}
			if (job.place()) {
				Boolean result = place(mc, player, world, job);
				if (result == null) {
					if (job.attempts() < MAX_ATTEMPTS) {
						retry.add(new Job(job.pos(), job.state(), true, ticks + 2, job.attempts() + 1));
					}
					continue;
				}
				if (result) {
					budget--;
					if (current != null) {
						current.add(job.pos());
					}
				}
			} else {
				if (world.getBlockState(job.pos()).isAir() || !player.isCreative()) {
					continue;
				}
				mc.interactionManager.attackBlock(job.pos(), Direction.UP);
				budget--;
			}
		}
		for (Job job : retry) {
			QUEUE.addLast(job);
		}
		if (player.getInventory().getSelectedSlot() != originalSlot) {
			player.getInventory().setSelectedSlot(originalSlot);
		}
	}

	/** @return true if placed, false if impossible (skip), null if it should be retried later */
	private static Boolean place(MinecraftClient mc, ClientPlayerEntity player, ClientWorld world, Job job) {
		BlockPos pos = job.pos();
		if (!world.getBlockState(pos).isReplaceable()) {
			return false;
		}
		int slot = findSlot(player, job.state());
		if (slot < 0) {
			return false;
		}
		Direction face = null;
		BlockPos support = null;
		for (Direction dir : Direction.values()) {
			BlockPos n = pos.offset(dir);
			BlockState ns = world.getBlockState(n);
			if (ns.isReplaceable() || ns.hasBlockEntity() || ns.createScreenHandlerFactory(world, n) != null) {
				continue;
			}
			if (face == null || ns.isSolidBlock(world, n)) {
				face = dir.getOpposite();
				support = n;
				if (ns.isSolidBlock(world, n)) {
					break;
				}
			}
		}
		if (support == null) {
			return null;
		}
		player.getInventory().setSelectedSlot(slot);
		Vec3d hit = Vec3d.ofCenter(support).add(Vec3d.of(face.getVector()).multiply(0.5));
		mc.interactionManager.interactBlock(player, Hand.MAIN_HAND, new BlockHitResult(hit, face, support, false));
		return true;
	}

	private static int findSlot(ClientPlayerEntity player, BlockState state) {
		int selected = player.getInventory().getSelectedSlot();
		ItemStack held = player.getInventory().getStack(selected);
		if (held.getItem() instanceof BlockItem bi && bi.getBlock() == state.getBlock()) {
			return selected;
		}
		for (int slot = 0; slot < 9; slot++) {
			ItemStack stack = player.getInventory().getStack(slot);
			if (stack.getItem() instanceof BlockItem bi && bi.getBlock() == state.getBlock()) {
				return slot;
			}
		}
		return -1;
	}
}

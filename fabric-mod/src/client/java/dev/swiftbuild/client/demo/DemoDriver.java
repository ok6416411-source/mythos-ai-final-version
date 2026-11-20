package dev.swiftbuild.client.demo;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.FillMode;
import dev.swiftbuild.build.Modifiers;
import dev.swiftbuild.client.BuildController;
import dev.swiftbuild.client.ClientConfig;
import dev.swiftbuild.client.SwiftBuildClient;
import dev.swiftbuild.client.gui.BuildHud;
import dev.swiftbuild.client.gui.ModifierScreen;
import dev.swiftbuild.client.gui.RadialMenuScreen;
import dev.swiftbuild.net.BuildRequestPayload;
import dev.swiftbuild.server.BuildService;
import java.util.List;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.util.ScreenshotRecorder;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.resource.DataConfiguration;
import net.minecraft.server.integrated.IntegratedServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.Difficulty;
import net.minecraft.world.GameMode;
import net.minecraft.world.rule.GameRules;
import net.minecraft.world.gen.GeneratorOptions;
import net.minecraft.world.gen.WorldPresets;
import net.minecraft.world.level.LevelInfo;
import org.lwjgl.glfw.GLFW;

/**
 * Development-only screenshot script (enabled with -Dswiftbuild.demo=true, excluded from the
 * release jar). Creates a flat creative world, builds a few shapes and captures screenshots of
 * the animation, the hologram preview, the radial menu and the settings screen.
 */
public final class DemoDriver {
	private static int tick;
	private static int worldTick = -1;
	private static boolean worldRequested;

	private DemoDriver() {
	}

	public static void install() {
		ClientTickEvents.END_CLIENT_TICK.register(DemoDriver::onTick);
	}

	private static void onTick(MinecraftClient mc) {
		tick++;
		if (!worldRequested && (mc.currentScreen instanceof TitleScreen || tick > 200) && mc.world == null) {
			worldRequested = true;
			LevelInfo info = new LevelInfo("swiftbuild-demo", GameMode.CREATIVE, false, Difficulty.PEACEFUL, true,
				new GameRules(DataConfiguration.SAFE_MODE.enabledFeatures()), DataConfiguration.SAFE_MODE);
			mc.createIntegratedServerLoader().createAndStart("swiftbuild-demo", info, new GeneratorOptions(42L, false, false),
				WorldPresets::createTestOptions, new TitleScreen());
			return;
		}
		if (mc.world == null || mc.player == null || mc.getServer() == null) {
			return;
		}
		if (worldTick < 0) {
			worldTick = 0;
		}
		int t = worldTick++;
		IntegratedServer server = mc.getServer();

		switch (t) {
			case 60 -> {
				ClientConfig c = ClientConfig.get();
				c.mode = BuildMode.VANILLA;
				c.modifiers = Modifiers.NONE;
				c.mix = false;
				c.animations = true;
				c.preview = true;
				c.hud = true;
				cmd(server, "time set 6000");
				cmd(server, "weather clear");
				cmd(server, "fill -40 -61 -40 40 -61 40 minecraft:grass_block");
				cmd(server, "fill -6 -61 -6 6 -61 6 minecraft:smooth_stone");
				cmd(server, "tp @p 0 -60 -22 0 18");
				onServer(server, p -> {
					ItemStack[] hotbar = {
						new ItemStack(Items.STONE_BRICKS, 64), new ItemStack(Items.GLASS, 64), new ItemStack(Items.SANDSTONE, 64),
						new ItemStack(Items.OAK_PLANKS, 64), new ItemStack(Items.QUARTZ_BLOCK, 64), new ItemStack(Items.BRICKS, 64),
						new ItemStack(Items.CYAN_TERRACOTTA, 64), new ItemStack(Items.MOSSY_STONE_BRICKS, 64), new ItemStack(Items.CRACKED_STONE_BRICKS, 64)};
					for (int i = 0; i < 9; i++) {
						p.getInventory().setStack(i, hotbar[i]);
					}
				});
			}
			// --- 1: build animation (shapes rippling in)
			case 120 -> {
				build(server, 1, BuildMode.SPHERE, FillMode.HOLLOW, List.of(new BlockPos(0, -55, 6), new BlockPos(5, -55, 6)), Modifiers.NONE, false);
			}
			case 123 -> build(server, 2, BuildMode.PYRAMID, FillMode.FILLED, List.of(new BlockPos(-18, -60, 0), new BlockPos(-9, -60, 9)), Modifiers.NONE, false);
			case 126 -> build(server, 0, BuildMode.CYLINDER, FillMode.HOLLOW, List.of(new BlockPos(14, -60, 4), new BlockPos(17, -60, 4), new BlockPos(17, -51, 4)), Modifiers.NONE, false);
			case 129 -> shot(mc, "swiftbuild_1_animation");
			case 133 -> shot(mc, "swiftbuild_1b_animation");
			// --- 2: finished builds incl. a mirrored, block-mixed wall
			case 200 -> {
				Modifiers mirror = Modifiers.NONE.withMirror(true, true, false, false, 1, 0, 0);
				build(server, 7, BuildMode.WALL, FillMode.FILLED, List.of(new BlockPos(3, -60, 18), new BlockPos(12, -56, 18)), mirror, true);
			}
			case 204 -> {
				build(server, 4, BuildMode.CUBE, FillMode.OUTLINE, List.of(new BlockPos(-4, -60, -12), new BlockPos(4, -60, -6), new BlockPos(4, -55, -6)), Modifiers.NONE, false);
			}
			case 300 -> shot(mc, "swiftbuild_2_builds");
			// --- 3: hologram preview while picking the points of a cube
			case 320 -> {
				cmd(server, "tp @p -14 -60 -22 0 30");
				select(mc, server, 3);
				ClientConfig.get().mode = BuildMode.CUBE;
				ClientConfig.get().fill = FillMode.HOLLOW;
				BuildController.onModeChanged();
				BuildHud.flash();
			}
			case 330 -> {
				look(mc, new Vec3d(-18.5, -60.9, -16.5));
				BuildController.onUse(mc);
			}
			case 334 -> look(mc, new Vec3d(-9.5, -60.5, -10.5));
			case 338 -> BuildController.onUse(mc);
			case 342 -> look(mc, new Vec3d(-9.5, -55.0, -10.5));
			case 370 -> shot(mc, "swiftbuild_3_preview");
			// --- 4: break preview (red)
			case 380 -> {
				BuildController.cancel();
				ClientConfig.get().mode = BuildMode.FLOOR;
				ClientConfig.get().fill = FillMode.FILLED;
				BuildController.onModeChanged();
				cmd(server, "tp @p 0 -60 -24 0 30");
			}
			case 390 -> {
				look(mc, new Vec3d(-4.5, -60.6, -11.5));
				BuildController.onAttack(mc);
			}
			case 394 -> look(mc, new Vec3d(4.5, -60.6, -7.5));
			case 420 -> shot(mc, "swiftbuild_4_break_preview");
			// --- 5: radial menu
			case 430 -> {
				BuildController.cancel();
				RadialMenuScreen.holdOverride = true;
				mc.setScreen(new RadialMenuScreen(SwiftBuildClient.menuKey));
			}
			case 433 -> shot(mc, "swiftbuild_5a_menu_opening");
			case 436 -> {
				int w = mc.getWindow().getWidth();
				int h = mc.getWindow().getHeight();
				double angle = -Math.PI / 2 + BuildMode.SPHERE.ordinal() * Math.PI * 2 / BuildMode.values().length;
				GLFW.glfwSetCursorPos(mc.getWindow().getHandle(), w / 2.0 + Math.cos(angle) * h * 0.18, h / 2.0 + Math.sin(angle) * h * 0.18);
			}
			case 460 -> shot(mc, "swiftbuild_5_menu");
			// --- 6: modifier screen
			case 470 -> {
				RadialMenuScreen.holdOverride = false;
				mc.setScreen(new ModifierScreen(null));
			}
			case 490 -> shot(mc, "swiftbuild_6_modifiers");
			case 500 -> mc.scheduleStop();
			default -> {
			}
		}
		if (t > 60 && t % 40 == 0) {
			cmd(server, "time set 6000");
		}
	}

	private static void cmd(IntegratedServer server, String command) {
		server.execute(() -> server.getCommandManager().parseAndExecute(server.getCommandSource(), command));
	}

	private static void onServer(IntegratedServer server, java.util.function.Consumer<ServerPlayerEntity> action) {
		server.execute(() -> {
			List<ServerPlayerEntity> players = server.getPlayerManager().getPlayerList();
			if (!players.isEmpty()) {
				action.accept(players.get(0));
			}
		});
	}

	private static void select(MinecraftClient mc, IntegratedServer server, int slot) {
		mc.player.getInventory().setSelectedSlot(slot);
		onServer(server, p -> p.getInventory().setSelectedSlot(slot));
	}

	private static void build(IntegratedServer server, int slot, BuildMode mode, FillMode fill, List<BlockPos> points, Modifiers mods, boolean mix) {
		onServer(server, p -> {
			p.getInventory().setSelectedSlot(slot);
			BuildService.handleBuild(p, new BuildRequestPayload(BuildAction.PLACE, mode, fill, points, Direction.UP, 0.5f, 0f, 0.5f, mods, mix, 1234L));
		});
	}

	private static void look(MinecraftClient mc, Vec3d target) {
		Vec3d eye = mc.player.getEyePos();
		double dx = target.x - eye.x;
		double dy = target.y - eye.y;
		double dz = target.z - eye.z;
		double horizontal = Math.sqrt(dx * dx + dz * dz);
		float yaw = (float) (MathHelper.atan2(dz, dx) * 180 / Math.PI) - 90f;
		float pitch = (float) (-(MathHelper.atan2(dy, horizontal) * 180 / Math.PI));
		mc.player.setYaw(yaw);
		mc.player.setPitch(pitch);
		mc.player.lastYaw = yaw;
		mc.player.lastPitch = pitch;
	}

	private static void shot(MinecraftClient mc, String name) {
		ScreenshotRecorder.saveScreenshot(mc.runDirectory, name + ".png", mc.getFramebuffer(), 1, msg -> {
		});
	}
}

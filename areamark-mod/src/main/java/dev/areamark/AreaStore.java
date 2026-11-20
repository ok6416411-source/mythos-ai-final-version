package dev.areamark;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;

/** Areas of the current world / server, saved to config/areamark/<world>.json. */
public final class AreaStore {
	public static final int[] COLORS = {0xFFFFAA28, 0xFFFF5A6E, 0xFF7BE07B, 0xFF4FD1E0, 0xFF5A8CFF, 0xFFB57BFF, 0xFFFFE066, 0xFFF5F5F5};
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	public static final long COLLAPSE_MS = 450;

	private static final List<Area> AREAS = new ArrayList<>();
	private static String worldKey;

	private AreaStore() {
	}

	public static List<Area> all() {
		return AREAS;
	}

	public static String currentDim() {
		MinecraftClient mc = MinecraftClient.getInstance();
		return mc.world == null ? "minecraft:overworld" : mc.world.getRegistryKey().getValue().toString();
	}

	private static String computeKey(MinecraftClient mc) {
		String key;
		if (mc.isInSingleplayer() && mc.getServer() != null) {
			key = "sp_" + mc.getServer().getSaveProperties().getLevelName();
		} else {
			ServerInfo info = mc.getCurrentServerEntry();
			key = "mp_" + (info == null ? "unknown" : info.address);
		}
		return key.replaceAll("[^A-Za-z0-9._-]", "_");
	}

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("areamark").resolve(worldKey + ".json");
	}

	public static void onJoin(MinecraftClient mc) {
		worldKey = computeKey(mc);
		AREAS.clear();
		try {
			Path f = file();
			if (Files.exists(f)) {
				try (Reader r = Files.newBufferedReader(f)) {
					List<Area> loaded = GSON.fromJson(r, new TypeToken<List<Area>>() { }.getType());
					if (loaded != null) {
						long now = Util.getMeasuringTimeMs();
						for (Area a : loaded) {
							a.appearAt = now;
							a.removingAt = -1;
							a.origin = a.min();
							AREAS.add(a);
						}
					}
				}
			}
		} catch (Exception e) {
			AreaMark.LOGGER.warn("Could not read areas", e);
		}
	}

	public static void onLeave() {
		save();
		AREAS.clear();
		worldKey = null;
	}

	public static void save() {
		if (worldKey == null) {
			return;
		}
		try {
			Path f = file();
			Files.createDirectories(f.getParent());
			List<Area> keep = new ArrayList<>();
			for (Area a : AREAS) {
				if (a.removingAt < 0) {
					keep.add(a);
				}
			}
			try (Writer w = Files.newBufferedWriter(f)) {
				GSON.toJson(keep, w);
			}
		} catch (Exception e) {
			AreaMark.LOGGER.warn("Could not save areas", e);
		}
	}

	public static Area add(BlockPos a, BlockPos b) {
		int n = 1;
		for (Area x : AREAS) {
			if (x.removingAt < 0) {
				n++;
			}
		}
		String name = (a.equals(b) ? "Block " : "Bereich ") + n;
		Area area = new Area(name, a, b, COLORS[(n - 1) % COLORS.length], currentDim());
		area.appearAt = Util.getMeasuringTimeMs();
		AREAS.add(area);
		save();
		return area;
	}

	public static void remove(Area a) {
		if (a.removingAt < 0) {
			a.removingAt = Util.getMeasuringTimeMs();
			save();
		}
	}

	public static void tick() {
		long now = Util.getMeasuringTimeMs();
		AREAS.removeIf(a -> a.removingAt >= 0 && now - a.removingAt > COLLAPSE_MS);
	}
}

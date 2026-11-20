package dev.swiftbuild.server;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import dev.swiftbuild.SwiftBuild;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** Server-side limits, stored in config/swiftbuild-server.json. */
public final class ServerConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	public int maxBlocksCreative = 10000;
	public int maxBlocksSurvival = 1024;
	public int reachCreative = 96;
	public int reachSurvival = 10;
	public boolean allowSurvivalBreaking = true;
	/** Delay between rings of the build wave, in ticks per block of distance. */
	public double waveTicksPerBlock = 0.5;
	/** Upper bound for the whole wave so huge builds do not take forever. */
	public int maxWaveTicks = 40;
	/** How long the grow / shrink animation of one block lasts, in ticks. */
	public int animationTicks = 5;
	public boolean animations = true;
	public int historySize = 32;
	public int maxPlaceSoundsPerTick = 4;

	private static ServerConfig instance = new ServerConfig();

	public static ServerConfig get() {
		return instance;
	}

	public static void load() {
		Path file = FabricLoader.getInstance().getConfigDir().resolve("swiftbuild-server.json");
		try {
			if (Files.exists(file)) {
				try (Reader reader = Files.newBufferedReader(file)) {
					ServerConfig loaded = GSON.fromJson(reader, ServerConfig.class);
					if (loaded != null) {
						instance = loaded;
					}
				}
			}
			try (Writer writer = Files.newBufferedWriter(file)) {
				GSON.toJson(instance, writer);
			}
		} catch (Exception e) {
			SwiftBuild.LOGGER.warn("Could not read {}, using defaults", file, e);
		}
	}
}

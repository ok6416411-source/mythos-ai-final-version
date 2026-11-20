package dev.livelyhands;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** config/livelyhands.json – every effect can be switched off or scaled. */
public final class LivelyConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	/** Master switch (key K by default). */
	public boolean enabled = true;
	public boolean firstPerson = true;
	public boolean thirdPerson = true;
	public boolean itemPhysics = true;
	public boolean camera = true;
	/** First-person strength; 1.0 = default, 0.5 = subtle, 2.0 = wild. */
	public float intensity = 1.0f;
	public float thirdPersonIntensity = 1.0f;
	public float cameraIntensity = 1.0f;
	public boolean inertia = true;
	public boolean movementTilt = true;
	public boolean jumpAndLanding = true;
	public boolean idleBreathing = true;
	public boolean swingStyles = true;
	public boolean equipFlip = true;
	public boolean eatingWobble = true;
	public boolean inspect = true;

	private static LivelyConfig instance = new LivelyConfig();

	public static LivelyConfig get() {
		return instance;
	}

	public static void load() {
		Path file = FabricLoader.getInstance().getConfigDir().resolve("livelyhands.json");
		try {
			if (Files.exists(file)) {
				try (Reader reader = Files.newBufferedReader(file)) {
					LivelyConfig loaded = GSON.fromJson(reader, LivelyConfig.class);
					if (loaded != null) {
						instance = loaded;
					}
				}
			}
			try (Writer writer = Files.newBufferedWriter(file)) {
				GSON.toJson(instance, writer);
			}
		} catch (Exception e) {
			LivelyHands.LOGGER.warn("Could not read {}, using defaults", file, e);
		}
	}

	public static void save() {
		Path file = FabricLoader.getInstance().getConfigDir().resolve("livelyhands.json");
		try (Writer writer = Files.newBufferedWriter(file)) {
			GSON.toJson(instance, writer);
		} catch (Exception e) {
			LivelyHands.LOGGER.warn("Could not write {}", file, e);
		}
	}
}

package dev.swiftbuild.build;

import java.util.Locale;

public enum FillMode {
	FILLED,
	HOLLOW,
	OUTLINE;

	public FillMode next() {
		return values()[(ordinal() + 1) % values().length];
	}

	public String translationKey() {
		return "swiftbuild.fill." + name().toLowerCase(Locale.ROOT);
	}

	public static FillMode byId(int id) {
		FillMode[] values = values();
		return id >= 0 && id < values.length ? values[id] : FILLED;
	}
}

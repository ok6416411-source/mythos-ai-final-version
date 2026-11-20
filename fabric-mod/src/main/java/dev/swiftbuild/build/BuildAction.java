package dev.swiftbuild.build;

public enum BuildAction {
	PLACE,
	BREAK;

	public static BuildAction byId(int id) {
		return id == 1 ? BREAK : PLACE;
	}
}

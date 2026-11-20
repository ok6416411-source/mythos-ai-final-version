package dev.swiftbuild.net;

import dev.swiftbuild.SwiftBuild;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;

/** Client → server: undo (redo = false) or redo (redo = true) the last build. */
public record UndoPayload(boolean redo) implements CustomPayload {
	public static final CustomPayload.Id<UndoPayload> ID = new CustomPayload.Id<>(SwiftBuild.id("undo"));
	public static final PacketCodec<PacketByteBuf, UndoPayload> CODEC = PacketCodec.of(
		(p, buf) -> buf.writeBoolean(p.redo),
		buf -> new UndoPayload(buf.readBoolean())
	);

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}

package dev.swiftbuild.net;

import dev.swiftbuild.SwiftBuild;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;

/** Server → client on join: tells the client the server runs SwiftBuild and which limits apply. */
public record HelloPayload(int reachCreative, int reachSurvival, int maxBlocksCreative, int maxBlocksSurvival) implements CustomPayload {
	public static final CustomPayload.Id<HelloPayload> ID = new CustomPayload.Id<>(SwiftBuild.id("hello"));
	public static final PacketCodec<PacketByteBuf, HelloPayload> CODEC = PacketCodec.of(
		(p, buf) -> {
			buf.writeVarInt(p.reachCreative);
			buf.writeVarInt(p.reachSurvival);
			buf.writeVarInt(p.maxBlocksCreative);
			buf.writeVarInt(p.maxBlocksSurvival);
		},
		buf -> new HelloPayload(buf.readVarInt(), buf.readVarInt(), buf.readVarInt(), buf.readVarInt())
	);

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}

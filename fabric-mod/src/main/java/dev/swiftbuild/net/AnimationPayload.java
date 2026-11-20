package dev.swiftbuild.net;

import dev.swiftbuild.SwiftBuild;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;

/**
 * Server → nearby clients: which blocks are about to appear or vanish and when, so
 * the client can play the grow / shrink animation in sync with the real block change.
 */
public record AnimationPayload(int animTicks, List<Entry> entries) implements CustomPayload {
	public static final int MAX_ENTRIES = 16384;
	public static final byte GROW = 0;
	public static final byte SHRINK = 1;

	public record Entry(BlockPos pos, int stateId, int delayTicks, byte kind) {
	}

	public static final CustomPayload.Id<AnimationPayload> ID = new CustomPayload.Id<>(SwiftBuild.id("animation"));
	public static final PacketCodec<PacketByteBuf, AnimationPayload> CODEC = PacketCodec.of(
		(p, buf) -> {
			buf.writeVarInt(p.animTicks);
			buf.writeVarInt(p.entries.size());
			for (Entry e : p.entries) {
				buf.writeLong(e.pos.asLong());
				buf.writeVarInt(e.stateId);
				buf.writeVarInt(e.delayTicks);
				buf.writeByte(e.kind);
			}
		},
		buf -> {
			int anim = buf.readVarInt();
			int count = MathHelper.clamp(buf.readVarInt(), 0, MAX_ENTRIES);
			List<Entry> list = new ArrayList<>(count);
			for (int i = 0; i < count; i++) {
				list.add(new Entry(BlockPos.fromLong(buf.readLong()), buf.readVarInt(), buf.readVarInt(), buf.readByte()));
			}
			return new AnimationPayload(anim, list);
		}
	);

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}

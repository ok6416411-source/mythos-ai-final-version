package dev.swiftbuild.net;

import dev.swiftbuild.SwiftBuild;
import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.FillMode;
import dev.swiftbuild.build.Modifiers;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.MathHelper;

/** Client → server: "build this shape". The server recomputes all positions itself. */
public record BuildRequestPayload(
	BuildAction action, BuildMode mode, FillMode fill, List<BlockPos> points,
	Direction side, float hitX, float hitY, float hitZ,
	Modifiers modifiers, boolean mix, long seed
) implements CustomPayload {
	public static final CustomPayload.Id<BuildRequestPayload> ID = new CustomPayload.Id<>(SwiftBuild.id("build"));
	public static final PacketCodec<PacketByteBuf, BuildRequestPayload> CODEC = PacketCodec.of(
		(p, buf) -> {
			buf.writeByte(p.action.ordinal());
			buf.writeByte(p.mode.ordinal());
			buf.writeByte(p.fill.ordinal());
			buf.writeVarInt(p.points.size());
			for (BlockPos pos : p.points) {
				buf.writeBlockPos(pos);
			}
			buf.writeEnumConstant(p.side);
			buf.writeFloat(p.hitX);
			buf.writeFloat(p.hitY);
			buf.writeFloat(p.hitZ);
			Modifiers.CODEC.encode(buf, p.modifiers);
			buf.writeBoolean(p.mix);
			buf.writeLong(p.seed);
		},
		buf -> {
			BuildAction action = BuildAction.byId(buf.readByte());
			BuildMode mode = BuildMode.byId(buf.readByte());
			FillMode fill = FillMode.byId(buf.readByte());
			int count = MathHelper.clamp(buf.readVarInt(), 0, 3);
			List<BlockPos> points = new ArrayList<>(count);
			for (int i = 0; i < count; i++) {
				points.add(buf.readBlockPos());
			}
			Direction side = buf.readEnumConstant(Direction.class);
			float hx = MathHelper.clamp(buf.readFloat(), 0f, 1f);
			float hy = MathHelper.clamp(buf.readFloat(), 0f, 1f);
			float hz = MathHelper.clamp(buf.readFloat(), 0f, 1f);
			Modifiers modifiers = Modifiers.CODEC.decode(buf);
			boolean mix = buf.readBoolean();
			long seed = buf.readLong();
			return new BuildRequestPayload(action, mode, fill, points, side, hx, hy, hz, modifiers, mix, seed);
		}
	);

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}

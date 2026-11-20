package dev.livelyhands.mixin;

import dev.livelyhands.ThirdPerson;
import net.minecraft.client.render.entity.model.BipedEntityModel;
import net.minecraft.client.render.entity.state.BipedEntityRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Runs for the player model and for armour models, so armour follows every pose. */
@Mixin(BipedEntityModel.class)
public abstract class BipedEntityModelMixin {
	@Inject(method = "setAngles(Lnet/minecraft/client/render/entity/state/BipedEntityRenderState;)V", at = @At("TAIL"))
	private void livelyhands$pose(BipedEntityRenderState state, CallbackInfo ci) {
		ThirdPerson.apply((BipedEntityModel<?>) (Object) this, state);
	}
}

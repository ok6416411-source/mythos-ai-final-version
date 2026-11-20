package dev.livelyhands;

/** Damped spring: follows a target with a little overshoot, which makes motion feel physical. */
public final class Spring {
	public float pos;
	public float vel;

	public void update(float target, float stiffness, float damping, float dt) {
		float accel = stiffness * (target - pos) - damping * vel;
		vel += accel * dt;
		pos += vel * dt;
	}

	public void reset(float value) {
		pos = value;
		vel = 0;
	}
}

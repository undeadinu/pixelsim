#version 120

#define M_PI 3.1415926535

////////////////////////////////////////////////////////////////////////////////

varying vec2 tex_coord;

uniform sampler2D pos;
uniform sampler2D vel;
uniform sampler2D filled;

uniform ivec2 ship_size;

uniform float k_linear;     // linear spring constant
uniform float k_torsional;  // angular spring constant

uniform float c_linear;     // linear damping
uniform float c_torsional;  // torsional damping

uniform float m;    // point's mass
uniform float I;    // point's inertia

////////////////////////////////////////////////////////////////////////////////

// near and far are x,y,a coordinates.
// delta is the nominal vector from near to far.  In all likelihood, far
// is somewhere else, which exerts a force.
vec3 spring_accel(vec3 near, vec2 delta, vec3 far)
{
    // A pixel can't influence itself.
    if (delta.x == 0.0f && delta.y == 0.0f)     return vec3(0.0f, 0.0f, 0.0f);

    // Vectors pointing from far to near
    vec2 d = near.xy - far.xy;

    // Start with the force contribution due to linear spring
    float magnitude = k_linear * (length(delta) - length(d));
    vec3 force = vec3(magnitude * normalize(d), 0.0f);

    // Find the force from the far point's angular spring torquing
    // being exerted on the near point.
    {
        // Find the angle between our desired beam and the actual beam, from
        // the perspective of the far point (which is exerting this force).
        float d_angle = atan(d.y, d.x) - atan(-delta.y, -delta.x) + far.z;
        while (d_angle < -M_PI)    d_angle += 2*M_PI;
        while (d_angle >  M_PI)    d_angle -= 2*M_PI;

        // Force direction is 90 degrees from moment arm
        vec2 force_direction = normalize(vec2(-d.y, d.x));

        // Acceleration from torsional spring at far point:
        // direction vector * (angle * k * lever arm length) / mass
        force.xy += force_direction *
            (-d_angle * k_torsional * length(d));
    }

    // Torque due to the near point's angular spring
    {
        // Desired angle from the perspective of the near point
        float d_angle = atan(-d.y, -d.x) - atan(delta.y, delta.x) - near.z;
        while (d_angle < -M_PI)    d_angle += 2*M_PI;
        while (d_angle >  M_PI)    d_angle -= 2*M_PI;

        force.z = d_angle * k_torsional;
    }

    return vec3(force.xy / m, force.z / I);
}

////////////////////////////////////////////////////////////////////////////////

vec3 damper_accel(vec3 near_pos, vec3 near_vel, vec3 far_pos, vec3 far_vel)
{
    vec3 force = vec3(0.0f);

    {
        vec2 vel = near_vel.xy - far_vel.xy;    // motion of near point
        vec2 d = near_pos.xy - far_pos.xy;

        // Start with the radial velocity component.
        vec2 radial = dot(vel, normalize(d)) * normalize(d);
        force.xy += -c_linear * radial;

        // Find angular velocity about the far point (in rad/sec)
        vec2 angular_direction = normalize(vec2(-d.y, d.x));
        float angular = far_pos.z - dot(angular_direction, vel) / length(d);

        force.xy += angular_direction * (angular * c_torsional) * length(d);
    }

    // Finally, let's figure out our angular damping.
    {
        vec2 vel = far_vel.xy - near_vel.xy;  // Motion of far point
        vec2 d = far_pos.xy - near_pos.xy;

        vec2 angular_direction = normalize(vec2(-d.y, d.x));
        float angular = dot(vel, angular_direction) / length(d) - near_vel.z;
        force.z = c_torsional * angular;
    }

    return vec3(force.xy / m, force.z / I);
}

////////////////////////////////////////////////////////////////////////////////

void main()
{
    vec3 near_pos = texture2D(pos, tex_coord).xyz;
    vec3 near_vel = texture2D(vel, tex_coord).xyz;

    vec3 total_accel = vec3(0.0f);

    // Iterate over the nine neighboring cells, accumulating forces.
    for (int dx=-1; dx <= 1; ++dx) {
        for (int dy=-1; dy <= 1; ++dy) {
            // Pick an offset that will give us the next pixel
            // in the desired direction.
            vec2 delta = vec2(dx, dy);
            vec2 far_tex_coord = tex_coord + vec2(delta.x / ship_size.x,
                                                  delta.y / ship_size.y);
            // If the chosen pixel is within the image (i.e. it has texture
            // coordinates between 0 and 1) and is marked as filled in the
            // pixel occupancy texture, then find and add its acceleration.
            if (far_tex_coord.x > 0.0f && far_tex_coord.x < 1.0f &&
                far_tex_coord.y > 0.0f && far_tex_coord.y < 1.0f &&
                texture2D(filled, far_tex_coord).r != 0)
            {
                // Get the actual location of the far point from the texture
                vec3 far_pos = texture2D(pos, far_tex_coord).xyz;
                vec3 far_vel = texture2D(vel, far_tex_coord).xyz;

                // Calculate and accumulate acceleration
                total_accel += spring_accel(near_pos, delta, far_pos) +
                               damper_accel(near_pos, near_vel,
                                            far_pos, far_vel);
            }
        }
    }

    // Accelerate engine pixels upwards
    if (texture2D(filled, tex_coord).r == 1.0f)   total_accel += vec3(0.0f, 1000.0f, 0.0f);

    gl_FragColor = vec4(total_accel, 1.0f);
}

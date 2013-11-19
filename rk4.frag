#version 330

uniform sampler2D y;

uniform sampler2D k1;
uniform sampler2D k2;
uniform sampler2D k3;
uniform sampler2D k4;

uniform float dt;
uniform ivec2 size;

out vec4 fragColor;

void main()
{
    vec2 tex_coord = vec2(gl_FragCoord.x / float(size.x + 1),
                          gl_FragCoord.y / float(size.y + 1));

    fragColor = vec4(
            texture(y, tex_coord).xyz + dt/6.0f * (
                texture(k1, tex_coord).xyz +
                2*texture(k2, tex_coord).xyz +
                2*texture(k3, tex_coord).xyz +
                texture(k4, tex_coord).xyz), 0.0f);
}

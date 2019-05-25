(function() {

  const SKYBOX_VERTEX_SHADER_SOURCE =
`#version 300 es

out vec3 v_dir;

uniform mat4 u_skyboxMatrix;
uniform vec2 u_targetScale;

const vec2[4] POSITIONS = vec2[](
  vec2(-1.0, -1.0),
  vec2(1.0, -1.0),
  vec2(-1.0, 1.0),
  vec2(1.0, 1.0)
);

const int[6] INDICES = int[](
  0, 1, 2,
  3, 2, 1
);

void main(void) {
  vec2 position = POSITIONS[INDICES[gl_VertexID]];
  vec3 dir = (u_skyboxMatrix * vec4(position * u_targetScale, -1.0, 0.0)).xyz;
  v_dir = normalize(dir);
  gl_Position = vec4(position, 0.0, 1.0);
}
`

  const SKYBOX_FRAGMENT_SHADER_SOURCE =
`#version 300 es

precision highp float;

in vec3 v_dir;

out vec4 o_color;

uniform sampler2D u_skyboxTexture;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679

vec3 sampleSphereMap(vec3 dir) {
  float phi = atan(dir.z, dir.x);
  float theta = acos(dir.y);
  vec2 uv = vec2(1.0 - (phi + PI) / TWO_PI, theta / PI);
  return texture(u_skyboxTexture, uv).rgb;
}

void main(void) {
  vec3 skybox = sampleSphereMap(v_dir);
  o_color = vec4(skybox, 1.0);
}
`;

  const IBL_VERTEX_SHADER_SOURCE =
`#version 300 es

layout (location = 0) in vec3 i_position;
layout (location = 1) in vec3 i_normal;

out vec3 v_position;
out vec3 v_normal;

uniform mat4 u_modelMatrix;
uniform mat4 u_normalMatrix;
uniform mat4 u_mvpMatrix;

void main(void) {
  vec4 position = vec4(i_position, 1.0);
  v_position = (u_modelMatrix * position).xyz;
  v_normal = (u_normalMatrix * vec4(i_normal, 0.0)).xyz;
  gl_Position = u_mvpMatrix * position;
}
`;

  const IBL_FRAGMENT_SHADER_SOURCE =
`#version 300 es

precision highp float;

in vec3 v_position;
in vec3 v_normal;

out vec4 o_color;

uniform sampler2D u_skyboxTexture;
uniform vec3 u_cameraPos;
uniform vec3 u_albedo;
uniform float u_specIntensity;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679

vec3 sampleSphereMap(vec3 dir) {
  float phi = atan(dir.z, dir.x);
  float theta = acos(dir.y);
  vec2 uv = vec2(1.0 - (phi + PI) / TWO_PI, theta / PI);
  return texture(u_skyboxTexture, uv).rgb;
}

vec3 fresnelSchlick(vec3 f90, float cosine) {
  return f90 + (1.0 - f90) * pow(1.0 - cosine, 5.0);
}

void main(void) {
  vec3 normal = normalize(v_normal);
  vec3 viewDir = normalize(u_cameraPos - v_position);
  vec3 reflectDir = reflect(-viewDir, normal);
  float dotNR = clamp(dot(normal, reflectDir), 0.0, 1.0);

  vec3 skyboxSpec = u_specIntensity * sampleSphereMap(reflectDir).rgb;

  vec3 color = fresnelSchlick(u_albedo, dotNR) * skyboxSpec;
  o_color = vec4(color, 1.0);
}
`;

  function create2dTexture(gl, image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  const createLoadImagePromise = function(src) {
    return new Promise(function(resolve) {
      const image = new Image();
      image.onload = function() {
        resolve(image);
      }
      image.src = src;
    });
  }

  const CAMERA_VFOV = 60.0;

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  const parameters = {
    sphere: {
      'albedo': [255.0, 255.0, 255.0],
    },
    box: {
      'albedo': [255.0, 255.0, 255.0],
    },
    torus: {
      'albedo': [255.0, 255.0, 255.0],
    },
    'specular intensity': 1.0,
  };

  const gui = new dat.GUI();
  const sphereFolder = gui.addFolder('sphere');
  sphereFolder.addColor(parameters.sphere, 'albedo');
  sphereFolder.open();
  const boxFolder = gui.addFolder('box');
  boxFolder.addColor(parameters.box, 'albedo');
  boxFolder.open();
  const torusFolder = gui.addFolder('torus');
  torusFolder.addColor(parameters.torus, 'albedo');
  torusFolder.open();
  gui.add(parameters, 'specular intensity', 0.0, 2.0).step(0.01);

  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl2');

  const resizeCanvas = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0.0, 0.0, canvas.width, canvas.height);
  };
  resizeCanvas();
  addEventListener('resize', resizeCanvas);

  const skyboxProgram = createProgramFromSource(gl, SKYBOX_VERTEX_SHADER_SOURCE, SKYBOX_FRAGMENT_SHADER_SOURCE);
  const iblProgram = createProgramFromSource(gl, IBL_VERTEX_SHADER_SOURCE, IBL_FRAGMENT_SHADER_SOURCE);

  const skyboxUniforms = getUniformLocations(gl, skyboxProgram, ['u_skyboxMatrix', 'u_targetScale', 'u_skyboxTexture']);
  const iblUniforms = getUniformLocations(gl, iblProgram,
    ['u_modelMatrix', 'u_normalMatrix', 'u_mvpMatrix', 'u_skyboxTexture', 'u_cameraPos', 'u_albedo', 'u_specIntensity']);

  const sphereMesh = createSphere(5.0, 16, 32);
  const torusMesh = createTorus(5.0, 2.0, 32, 16);
  const boxMesh = createBox(10.0, 10.0, 10.0, 10, 10, 10);

  const sphereVao = createVao(gl, [
    { buffer: createVbo(gl, sphereMesh.positions), index: 0, size: 3 },
    { buffer: createVbo(gl, sphereMesh.normals), index: 1, size: 3 }
  ], createIbo(gl, sphereMesh.indices));
  const torusVao = createVao(gl, [
    { buffer: createVbo(gl, torusMesh.positions), index: 0, size: 3 },
    { buffer: createVbo(gl, torusMesh.normals), index: 1, size: 3 }
  ], createIbo(gl, torusMesh.indices));
  const boxVao = createVao(gl, [
    { buffer: createVbo(gl, boxMesh.positions), index: 0, size: 3 },
    { buffer: createVbo(gl, boxMesh.normals), index: 1, size: 3 }
  ], createIbo(gl, boxMesh.indices));

  let skyboxTexture;
  const startTime = performance.now();
  const render = function() {
    stats.update();

    const currentTime = performance.now();
    const elapsedTime = (currentTime - startTime) * 0.001;

    const cameraPosition = new Vector3(
      30.0 * Math.cos(elapsedTime * 0.5),
      30.0 * Math.sin(elapsedTime * 0.3),
      30.0 * Math.sin(elapsedTime * 0.5)
    );

    const skyboxMatrix = Matrix4.lookTo(Vector3.sub(Vector3.zero, cameraPosition), Vector3.up);
  
    const viewMatrix = Matrix4.lookAt(cameraPosition, Vector3.zero, Vector3.up).inverse();
    const projectionMatrix = Matrix4.perspective(canvas.width / canvas.height, CAMERA_VFOV, 0.01, 1000.0);
    const vpMatrix = Matrix4.mul(viewMatrix, projectionMatrix);
  
    const sphereTransform = new Transform(
      Vector3.zero,
      Vector3.one,
      Vector3.zero
    );

    const torusTransform = new Transform(
      new Vector3(15.0, 0.0, 0.0),
      Vector3.one,
      new Vector3(elapsedTime * 0.5, elapsedTime * 0.2, 0.0)
    );

    const boxTransform = new Transform(
      new Vector3(-15.0, 0.0, 0.0),
      Vector3.one,
      new Vector3(elapsedTime * 0.2, elapsedTime * 0.5, 0.0)
    );

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(skyboxProgram);
    setUniformTexture(gl, 0, skyboxTexture, skyboxUniforms['u_skyboxTexture']);
    gl.uniformMatrix4fv(skyboxUniforms['u_skyboxMatrix'], false, skyboxMatrix.elements);
    const heightScale = Math.tan(0.5 * CAMERA_VFOV * Math.PI / 180.0);
    const widthScale = canvas.width / canvas.height * heightScale;
    gl.uniform2fv(skyboxUniforms['u_targetScale'], [widthScale, heightScale]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(iblProgram);
    setUniformTexture(gl, 0, skyboxTexture, iblUniforms['u_skyboxTexture']);
    gl.uniform3fv(iblUniforms['u_cameraPos'], cameraPosition.array);
    gl.uniform1f(iblUniforms['u_specIntensity'], parameters['specular intensity']);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, sphereTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, sphereTransform.normalMatrix.elements);
    const sphereMvpMatrix = Matrix4.mul(sphereTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, sphereMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.sphere['albedo'].map(v => v / 255.0));
    gl.bindVertexArray(sphereVao);
    gl.drawElements(gl.TRIANGLES, sphereMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, torusTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, torusTransform.normalMatrix.elements);
    const torusMvpMatrix = Matrix4.mul(torusTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, torusMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.torus['albedo'].map(v => v / 255.0));
    gl.bindVertexArray(torusVao);
    gl.drawElements(gl.TRIANGLES, torusMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, boxTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, boxTransform.normalMatrix.elements);
    const boxMvpMatrix = Matrix4.mul(boxTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, boxMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.box['albedo'].map(v => v / 255.0));
    gl.bindVertexArray(boxVao);
    gl.drawElements(gl.TRIANGLES, boxMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  createLoadImagePromise('./resources/latlongmap.jpg').then(image => {
    skyboxTexture = create2dTexture(gl, image);
    render();
  });

}());
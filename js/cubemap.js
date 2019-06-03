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

uniform samplerCube u_skyboxTexture;

#define HALF_PI 1.57079632679

mat2 rotate(float r) {
  float c = cos(r);
  float s = sin(r);
  return  mat2(c, s, -s, c);
}

vec4 sampleCubemap(samplerCube cubemap, vec3 v) {
  v.xz *= rotate(HALF_PI);
  v.x *= -1.0;
  return texture(cubemap, v);
}

void main(void) {
  vec3 skybox = sampleCubemap(u_skyboxTexture, v_dir).rgb;
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

uniform samplerCube u_skyboxTexture;
uniform float u_maxLodLevel;
uniform vec3 u_cameraPos;
uniform vec3 u_albedo;
uniform float u_roughness;
uniform float u_metallic;
uniform float u_diffIntensity;
uniform float u_specIntensity;

#define HALF_PI 1.57079632679

mat2 rotate(float r) {
  float c = cos(r);
  float s = sin(r);
  return  mat2(c, s, -s, c);
}

vec4 sampleCubemapLod(samplerCube cubemap, vec3 v, float lod) {
  v.xz *= rotate(HALF_PI);
  v.x *= -1.0;
  return textureLod(cubemap, v, lod);
}

vec3 fresnelSchlick(vec3 f90, float cosine) {
  return f90 + (1.0 - f90) * pow(1.0 - cosine, 5.0);
}

void main(void) {
  vec3 normal = normalize(v_normal);
  vec3 viewDir = normalize(u_cameraPos - v_position);
  vec3 reflectDir = reflect(-viewDir, normal);
  float dotNR = clamp(dot(normal, reflectDir), 0.0, 1.0);

  vec3 diffColor = mix(vec3(0.0), u_albedo, 1.0 - u_metallic);
  vec3 specColor = mix(vec3(0.04), u_albedo, u_metallic);

  vec3 skyboxDiff = u_diffIntensity * sampleCubemapLod(u_skyboxTexture, normal, u_maxLodLevel).rgb;
  vec3 skyboxSpec = u_specIntensity * sampleCubemapLod(u_skyboxTexture, reflectDir, log2(u_roughness * pow(2.0, u_maxLodLevel))).rgb;

  vec3 color = skyboxDiff * diffColor + fresnelSchlick(specColor, dotNR) * skyboxSpec;
  o_color = vec4(color, 1.0);
}
`;

  function createCubeMapTexture(gl, imageInfos) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    imageInfos.forEach(imageInfo => {
      gl.texImage2D(imageInfo.target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageInfo.image);
    });

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return texture;
  }

  const createLoadImagePromise = function(imageInfo) {
    return new Promise(function(resolve) {
      const image = new Image();
      image.onload = function() {
        resolve({ image: image, target: imageInfo.target });
      }
      image.src = imageInfo.src;
    });
  }

  const CAMERA_VFOV = 60.0;
  const SKYBOX_IMAGE_SIZE = 512;
  const SKYBOX_MAX_LOD = Math.log2(SKYBOX_IMAGE_SIZE);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  const parameters = {
    sphere: {
      'albedo': [255.0, 255.0, 255.0],
      'metallic': 1.0,
      'roughness': 0.0
    },
    box: {
      'albedo': [255.0, 255.0, 255.0],
      'metallic': 1.0,
      'roughness': 0.0
    },
    torus: {
      'albedo': [255.0, 255.0, 255.0],
      'metallic': 1.0,
      'roughness': 0.0
    },
    'diffuse intensity': 1.0,
    'specular intensity': 1.0,
  };

  const gui = new dat.GUI();
  const sphereFolder = gui.addFolder('sphere');
  sphereFolder.addColor(parameters.sphere, 'albedo');
  sphereFolder.add(parameters.sphere, 'metallic', 0.0, 1.0).step(0.01);
  sphereFolder.add(parameters.sphere, 'roughness', 0.0, 1.0).step(0.01);
  sphereFolder.open();
  const boxFolder = gui.addFolder('box');
  boxFolder.addColor(parameters.box, 'albedo');
  boxFolder.add(parameters.box, 'metallic', 0.0, 1.0).step(0.01);
  boxFolder.add(parameters.box, 'roughness', 0.0, 1.0).step(0.01);
  boxFolder.open();
  const torusFolder = gui.addFolder('torus');
  torusFolder.addColor(parameters.torus, 'albedo');
  torusFolder.add(parameters.torus, 'metallic', 0.0, 1.0).step(0.01);
  torusFolder.add(parameters.torus, 'roughness', 0.0, 1.0).step(0.01);
  torusFolder.open();
  gui.add(parameters, 'diffuse intensity', 0.0, 2.0).step(0.01);
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
    ['u_modelMatrix', 'u_normalMatrix', 'u_mvpMatrix', 'u_skyboxTexture', 'u_maxLodLevel', 'u_cameraPos', 'u_albedo', 'u_roughness', 'u_metallic', 'u_diffIntensity', 'u_specIntensity']);

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
    setUniformCubeMapTexture(gl, 0, skyboxTexture, skyboxUniforms['u_skyboxTexture']);
    gl.uniformMatrix4fv(skyboxUniforms['u_skyboxMatrix'], false, skyboxMatrix.elements);
    const heightScale = Math.tan(0.5 * CAMERA_VFOV * Math.PI / 180.0);
    const widthScale = canvas.width / canvas.height * heightScale;
    gl.uniform2fv(skyboxUniforms['u_targetScale'], [widthScale, heightScale]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(iblProgram);
    setUniformCubeMapTexture(gl, 0, skyboxTexture, iblUniforms['u_skyboxTexture']);
    gl.uniform1f(iblUniforms['u_maxLodLevel'], SKYBOX_MAX_LOD);
    gl.uniform3fv(iblUniforms['u_cameraPos'], cameraPosition.array);
    gl.uniform1f(iblUniforms['u_diffIntensity'], parameters['diffuse intensity']);
    gl.uniform1f(iblUniforms['u_specIntensity'], parameters['specular intensity']);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, sphereTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, sphereTransform.normalMatrix.elements);
    const sphereMvpMatrix = Matrix4.mul(sphereTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, sphereMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.sphere['albedo'].map(v => v / 255.0));
    gl.uniform1f(iblUniforms['u_roughness'], parameters.sphere['roughness']);
    gl.uniform1f(iblUniforms['u_metallic'], parameters.sphere['metallic']);
    gl.bindVertexArray(sphereVao);
    gl.drawElements(gl.TRIANGLES, sphereMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, torusTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, torusTransform.normalMatrix.elements);
    const torusMvpMatrix = Matrix4.mul(torusTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, torusMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.torus['albedo'].map(v => v / 255.0));
    gl.uniform1f(iblUniforms['u_roughness'], parameters.torus['roughness']);
    gl.uniform1f(iblUniforms['u_metallic'], parameters.torus['metallic']);
    gl.bindVertexArray(torusVao);
    gl.drawElements(gl.TRIANGLES, torusMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.uniformMatrix4fv(iblUniforms['u_modelMatrix'], false, boxTransform.modelMatrix.elements);
    gl.uniformMatrix4fv(iblUniforms['u_normalMatrix'], false, boxTransform.normalMatrix.elements);
    const boxMvpMatrix = Matrix4.mul(boxTransform.modelMatrix, vpMatrix);
    gl.uniformMatrix4fv(iblUniforms['u_mvpMatrix'], false, boxMvpMatrix.elements);
    gl.uniform3fv(iblUniforms['u_albedo'], parameters.box['albedo'].map(v => v / 255.0));
    gl.uniform1f(iblUniforms['u_roughness'], parameters.box['roughness']);
    gl.uniform1f(iblUniforms['u_metallic'], parameters.box['metallic']);
    gl.bindVertexArray(boxVao);
    gl.drawElements(gl.TRIANGLES, boxMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  const imageInfos = [
    { src: './resources/cubemap/px.png', target: gl.TEXTURE_CUBE_MAP_POSITIVE_X },
    { src: './resources/cubemap/py.png', target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y },
    { src: './resources/cubemap/pz.png', target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z },
    { src: './resources/cubemap/nx.png', target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X },
    { src: './resources/cubemap/ny.png', target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y },
    { src: './resources/cubemap/nz.png', target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z },
  ];

  Promise.all(imageInfos.map(imageInfo => createLoadImagePromise(imageInfo))).then(imageInfos => {
    skyboxTexture = createCubeMapTexture(gl, imageInfos);
    render();
  });

}());
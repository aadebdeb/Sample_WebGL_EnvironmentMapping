
function addVertex2(vertices, vi, x, y) {
  vertices[vi++] = x;
  vertices[vi++] = y;
  return vi;
};

function addVertex3(vertices, vi, x, y, z) {
  vertices[vi++] = x;
  vertices[vi++] = y;
  vertices[vi++] = z;
  return vi;
};

function addTriangle(indices, i, v0, v1, v2) {
  indices[i++] = v0;
  indices[i++] = v1;
  indices[i++] = v2;
  return i;
};

function addQuad(indices, i, v00, v10, v01, v11) {
  indices[i] = v00;
  indices[i + 1] = indices[i + 5] = v10;
  indices[i + 2] = indices[i + 4] = v01;
  indices[i + 3] = v11;
  return i + 6;
};

function createSphere(radius, thetaSegment, phiSegment) {
  const vertexNum = 2 + (thetaSegment - 1) * phiSegment;
  const indexNum = phiSegment * 6 + (thetaSegment - 2) * phiSegment * 6;
  const indices = new Int16Array(indexNum);
  const positions = new Float32Array(3 * vertexNum);
  const normals = new Float32Array(3 * vertexNum);

  const thetaStep = Math.PI / thetaSegment;
  const phiStep = 2.0 * Math.PI / phiSegment;

  // setup positions & normals
  let posCount = 0;
  let normalCount = 0;
  posCount = addVertex3(positions, posCount, 0, -radius, 0);
  normalCount = addVertex3(normals, normalCount, 0, -1, 0);
  for (let hi = 1; hi < thetaSegment; hi++) {
    const theta = Math.PI - hi * thetaStep;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let pi = 0; pi < phiSegment; pi++) {
      const phi = pi * phiStep;
      const sinP = Math.sin(-phi);
      const cosP = Math.cos(-phi);
      const p = new Vector3(
        radius * sinT * cosP,
        radius * cosT,
        radius * sinT * sinP
      );
      posCount = addVertex3(positions, posCount, p.x, p.y, p.z);
      const np = Vector3.norm(p);
      normalCount = addVertex3(normals, normalCount, np.x, np.y, np.z);
    }
  }
  posCount = addVertex3(positions, posCount, 0, radius, 0);
  normalCount = addVertex3(normals, normalCount, 0, 1, 0);

  // setup indices
  let indexCount = 0;
  for (let pi = 0; pi < phiSegment; pi++) {
    indexCount = addTriangle(indices, indexCount, 0, pi !== phiSegment - 1 ? pi + 2 : 1, pi + 1);
  }
  for (let hi = 0; hi < thetaSegment - 2; hi++) {
    const hj = hi + 1;
    for (let pi = 0; pi < phiSegment; pi++) {
      const pj = pi !== phiSegment - 1 ? pi + 1 : 0;
      indexCount = addQuad(indices, indexCount, 
        pi + hi * phiSegment + 1,
        pj + hi * phiSegment + 1,
        pi + hj * phiSegment + 1,
        pj + hj * phiSegment + 1
      );
    }
  }
  for (let pi = 0; pi < phiSegment; pi++) {
    indexCount = addTriangle(indices, indexCount,
      vertexNum - 1,
      pi + (thetaSegment - 2) * phiSegment + 1,
      (pi !== phiSegment - 1 ? pi + 1 : 0) + (thetaSegment - 2) * phiSegment + 1
    );
  }

  return {
    indices: indices,
    positions: positions,
    normals: normals,
  };
};

function createBox(xSize, ySize, zSize, xSegment, ySegment, zSegment) {
  const vertexNum = 2 * ((xSegment + 1) * (ySegment + 1) + (ySegment + 1) * (zSegment + 1) + (zSegment + 1) * (xSegment + 1));
  const triangleNum = 2 * 2 * (xSegment * ySegment + ySegment * zSegment + zSegment * xSegment);
  const indices = new Int16Array(3.0 * triangleNum);
  const positions = new Float32Array(3 * vertexNum);
  const normals = new Float32Array(3 * vertexNum);

  const xStep = xSize / xSegment;
  const yStep = ySize / ySegment;
  const zStep = zSize / zSegment;
  const halfX = 0.5 * xSize;
  const halfY = 0.5 * ySize;
  const halfZ = 0.5 * zSize;

  let posCount = 0;
  let normalCount = 0;
  let vertexCount = 0;
  let indexCount = 0;

  // XY +Z plane
  for (let yi = 0; yi <= ySegment; yi++) {
    const y = yi * yStep - halfY;
    for (let xi = 0; xi <= xSegment; xi++) {
      const x = xi * xStep - halfX;
      posCount = addVertex3(positions, posCount, x, y, halfZ);
      normalCount = addVertex3(normals, normalCount, 0.0, 0.0, 1.0);
    }
  }
  for (let yi = 0; yi < ySegment; yi++) {
    const yj = yi + 1;
    for (let xi = 0; xi < xSegment; xi++) {
      const xj = xi + 1;
      const v00 = vertexCount + xi + yi * (xSegment + 1);
      const v10 = vertexCount + xj + yi * (xSegment + 1);
      const v01 = vertexCount + xi + yj * (xSegment + 1); 
      const v11 = vertexCount + xj + yj * (xSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (xSegment + 1) * (ySegment + 1);

  // ZY +X plane
  for (let yi = 0; yi <= ySegment; yi++) {
    const y = yi * yStep - halfY;
    for (let zi = zSegment; zi >= 0; zi--) {
      const z = zi * zStep - halfZ;
      posCount = addVertex3(positions, posCount, halfX, y, z);
      normalCount = addVertex3(normals, normalCount, 1.0, 0.0, 0.0);
    }
  }
  for (let yi = 0; yi < ySegment; yi++) {
    const yj = yi + 1;
    for (let zi = 0; zi < zSegment; zi++) {
      const zj = zi + 1;
      const v00 = vertexCount + zi + yi * (zSegment + 1);
      const v10 = vertexCount + zj + yi * (zSegment + 1);
      const v01 = vertexCount + zi + yj * (zSegment + 1); 
      const v11 = vertexCount + zj + yj * (zSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (zSegment + 1) * (ySegment + 1);

  // XY -Z plane
  for (let yi = 0; yi <= ySegment; yi++) {
    const y = yi * yStep - halfY;
    for (let xi = xSegment; xi >= 0; xi--) {
      const x = xi * xStep - halfX;
      posCount = addVertex3(positions, posCount, x, y, -halfZ);
      normalCount = addVertex3(normals, normalCount, 0.0, 0.0, -1.0);
    }
  }
  for (let yi = 0; yi < ySegment; yi++) {
    const yj = yi + 1;
    for (let xi = 0; xi < xSegment; xi++) {
      const xj = xi + 1;
      const v00 = vertexCount + xi + yi * (xSegment + 1);
      const v10 = vertexCount + xj + yi * (xSegment + 1);
      const v01 = vertexCount + xi + yj * (xSegment + 1); 
      const v11 = vertexCount + xj + yj * (xSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (xSegment + 1) * (ySegment + 1);

  // ZY -X plane
  for (let yi = 0; yi <= ySegment; yi++) {
    const y = yi * yStep - halfY;
    for (let zi = 0; zi <= zSegment; zi++) {
      const z = zi * zStep - halfZ;
      posCount = addVertex3(positions, posCount, -halfX, y, z);
      normalCount = addVertex3(normals, normalCount, -1.0, 0.0, 0.0);
    }
  }
  for (let yi = 0; yi < ySegment; yi++) {
    const yj = yi + 1;
    for (let zi = 0; zi < zSegment; zi++) {
      const zj = zi + 1;
      const v00 = vertexCount + zi + yi * (zSegment + 1);
      const v10 = vertexCount + zj + yi * (zSegment + 1);
      const v01 = vertexCount + zi + yj * (zSegment + 1); 
      const v11 = vertexCount + zj + yj * (zSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (zSegment + 1) * (ySegment + 1);

  // XZ +Y plane
  for (let zi = zSegment; zi >= 0; zi--) {
    const z = zi * zStep - halfZ;
    for (let xi = 0; xi <= xSegment; xi++) {
      const x = xi * xStep - halfX;
      posCount = addVertex3(positions, posCount, x, halfY, z);
      normalCount = addVertex3(normals, normalCount, 0.0, 1.0, 0.0);
    }
  }
  for (let zi = 0; zi < zSegment; zi++) {
    const zj = zi + 1;
    for (let xi = 0; xi < xSegment; xi++) {
      const xj = xi + 1;
      const v00 = vertexCount + xi + zi * (xSegment + 1);
      const v10 = vertexCount + xj + zi * (xSegment + 1);
      const v01 = vertexCount + xi + zj * (xSegment + 1); 
      const v11 = vertexCount + xj + zj * (xSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (xSegment + 1) * (zSegment + 1);

  // XZ -Y plane
  for (let zi = 0; zi <= zSegment; zi++) {
    const z = zi * zStep - halfZ;
    for (let xi = 0; xi <= xSegment; xi++) {
      const x = xi * xStep - halfX;
      posCount = addVertex3(positions, posCount, x, -halfY, z);
      normalCount = addVertex3(normals, normalCount, 0.0, -1.0, 0.0);
    }
  }
  for (let zi = 0; zi < zSegment; zi++) {
    const zj = zi + 1;
    for (let xi = 0; xi < xSegment; xi++) {
      const xj = xi + 1;
      const v00 = vertexCount + xi + zi * (xSegment + 1);
      const v10 = vertexCount + xj + zi * (xSegment + 1);
      const v01 = vertexCount + xi + zj * (xSegment + 1); 
      const v11 = vertexCount + xj + zj * (xSegment + 1);
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }
  vertexCount += (xSegment + 1) * (zSegment + 1);

  return {
    indices: indices,
    positions: positions,
    normals: normals,
  };
};


function createTorus(majorRadius, minorRadius, majorSegment, minorSegment) {
  const vertexNum = majorSegment * minorSegment;
  const indices = new Int16Array(6 * vertexNum);
  const positions = new Float32Array(3 * vertexNum);
  const normals = new Float32Array(3 * vertexNum);

  const majorStep = Math.PI * 2.0 / majorSegment;
  const minorStep = Math.PI * 2.0 / minorSegment;

  let posCount = 0;
  let normalCount = 0;

  // setup positions & normals
  for (let ai =0; ai < majorSegment; ai++) {
    const majorAng = ai * majorStep;
    const center = new Vector3(majorRadius * Math.cos(-majorAng), 0, majorRadius * Math.sin(-majorAng));
    for (let ii = 0; ii < minorSegment; ii++) {
      const minorAng = ii * minorStep;
      const minorX = majorRadius + minorRadius * Math.cos(minorAng);
      const position = new Vector3(
        minorX * Math.cos(-majorAng),
        minorRadius * Math.sin(minorAng),
        minorX * Math.sin(-majorAng)
      );
      posCount = addVertex3(positions, posCount, position.x, position.y, position.z);
      const normal = Vector3.sub(position, center).norm();
      normalCount = addVertex3(normals, normalCount, normal.x, normal.y, normal.z);
    }
  }

  // setup indices
  let indexCount = 0;
  for (let ai = 0; ai < majorSegment; ai++) {
    const aj = ai !== majorSegment - 1  ? ai + 1 : 0;
    for (let ii = 0; ii < minorSegment; ii++) {
      const ij = ii !== minorSegment - 1 ? ii + 1 : 0;
      const v00 = ii + ai * minorSegment;
      const v10 = ii + aj * minorSegment;
      const v01 = ij + ai * minorSegment;
      const v11 = ij + aj * minorSegment;
      indexCount = addQuad(indices, indexCount, v00, v10, v01, v11);
    }
  }

  return {
    indices: indices,
    positions: positions,
    normals: normals,
  };
}

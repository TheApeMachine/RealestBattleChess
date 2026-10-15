import * as THREE from 'three';

export interface UniversityOfficeRig {
  rootGroup: THREE.Group;
  rainPoints: THREE.Points;
  rainVelocities: Float32Array;
  windowDropletsMesh: THREE.Mesh;
  chalkboardCanvas: HTMLCanvasElement;
  chalkboardTex: THREE.CanvasTexture;
  crtScreenCanvas: HTMLCanvasElement;
  crtScreenTex: THREE.CanvasTexture;
  coffeeMachineGroup: THREE.Group;
  coffeeLedMat: THREE.MeshBasicMaterial;
  labEquipmentGroup: THREE.Group;
  deskLampLight: THREE.PointLight;
  windowMoonLight: THREE.SpotLight;
  fluorescentLight: THREE.PointLight;
  lastChalkSignature: string;
}

export function createUniversityOfficeRig(): UniversityOfficeRig {
  const rootGroup = new THREE.Group();
  // Position the office at origin when active (since the chessboard is completely hidden!)
  rootGroup.position.set(0, 0, 0);
  rootGroup.visible = false;

  // 1. ROOM SHELL: Worn Parquet Floor, Institutional Drywall & Wood Wainscoting
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2c221b,
    roughness: 0.78,
    metalness: 0.08,
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  rootGroup.add(floorMesh);

  // Threadbare office rug under desk
  const rugMat = new THREE.MeshStandardMaterial({
    color: 0x3b2328,
    roughness: 0.92,
    metalness: 0.02,
  });
  const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 4.2), rugMat);
  rugMesh.position.set(0, 0.01, -0.4);
  rootGroup.add(rugMesh);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e242d,
    roughness: 0.88,
    metalness: 0.05,
  });
  const wainscotMat = new THREE.MeshStandardMaterial({
    color: 0x2a1d15,
    roughness: 0.72,
    metalness: 0.08,
  });

  // Back wall (with cutout frame for the rainy window)
  const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.5, 0.25), wallMat);
  backWallLeft.position.set(-4.7, 3.25, -4.2);
  const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.5, 0.25), wallMat);
  backWallRight.position.set(4.7, 3.25, -4.2);
  const backWallBottom = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.35, 0.25), wallMat);
  backWallBottom.position.set(0, 0.675, -4.2);
  const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.35, 0.25), wallMat);
  backWallTop.position.set(0, 5.825, -4.2);
  rootGroup.add(backWallLeft, backWallRight, backWallBottom, backWallTop);

  // Wainscoting along the back & side walls
  const wainscotBack = new THREE.Mesh(new THREE.BoxGeometry(14, 1.15, 0.3), wainscotMat);
  wainscotBack.position.set(0, 0.575, -4.16);
  rootGroup.add(wainscotBack);

  // Left Wall (holds the green Slate Chalkboard)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.5, 12), wallMat);
  leftWall.position.set(-6.8, 3.25, 1.5);
  rootGroup.add(leftWall);

  // Right Wall (Bookshelves, Filing Cabinets & The Broken 1987 Coffee Machine)
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.5, 12), wallMat);
  rightWall.position.set(6.8, 3.25, 1.5);
  rootGroup.add(rightWall);

  // 2. TALL RAIN-STREAKED UNIVERSITY WINDOW & NIGHT CAMPUS SKYBOX BACKDROP
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0, 3.25, -4.2);
  rootGroup.add(windowGroup);

  // Outside rainy night sky & distant University of Greater Andromeda brutalist towers
  const nightSkyMat = new THREE.MeshBasicMaterial({
    color: 0x09111e,
  });
  const nightBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 6.2), nightSkyMat);
  nightBackdrop.position.set(0, 0, -1.6);
  windowGroup.add(nightBackdrop);

  // Distant campus silhouettes & glowing office windows in the rain
  const towerMat = new THREE.MeshBasicMaterial({ color: 0x050811 });
  const windowLitMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
  for (let i = 0; i < 5; i++) {
    const tw = 0.7 + (i % 2) * 0.35;
    const th = 1.8 + ((i * 7) % 3) * 0.65;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(tw, th, 0.2), towerMat);
    tower.position.set(-2.1 + i * 1.05, -1.2 + th * 0.5, -1.35);
    windowGroup.add(tower);

    // Tiny lit windows in the distant Administration Tower
    for (let r = 0; r < 3; r++) {
      if ((i + r) % 2 === 0) {
        const lit = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), windowLitMat);
        lit.position.set(
          tower.position.x + (r - 1) * 0.16,
          tower.position.y + (r - 1) * 0.32,
          -1.24
        );
        windowGroup.add(lit);
      }
    }
  }

  // Mullion window frames (Gothic-collegiate dark timber)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x161210,
    roughness: 0.6,
    metalness: 0.2,
  });
  const outerTop = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.16, 0.35), frameMat);
  outerTop.position.y = 1.9;
  const outerBot = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.2, 0.48), frameMat);
  outerBot.position.y = -1.9;
  const outerL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.9, 0.35), frameMat);
  outerL.position.x = -2.38;
  const outerR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.9, 0.35), frameMat);
  outerR.position.x = 2.38;
  const midVert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.8, 0.28), frameMat);
  const midHoriz = new THREE.Mesh(new THREE.BoxGeometry(4.76, 0.1, 0.28), frameMat);
  midHoriz.position.y = 0.2;
  windowGroup.add(outerTop, outerBot, outerL, outerR, midVert, midHoriz);

  // Wet translucent glass pane
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    roughness: 0.15,
    metalness: 0.1,
    transmission: 0.6,
  });
  const windowDropletsMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.75), glassMat);
  windowDropletsMesh.position.z = 0.02;
  windowGroup.add(windowDropletsMesh);

  // 3D Falling Rain Streaks outside the window
  const rainCount = 420;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainVelocities = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3 + 0] = (Math.random() - 0.5) * 5.2;
    rainPositions[i * 3 + 1] = (Math.random() - 0.5) * 4.2 + 3.25;
    rainPositions[i * 3 + 2] = -4.55 - Math.random() * 0.7;
    rainVelocities[i] = 4.8 + Math.random() * 2.8;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.055,
    transparent: true,
    opacity: 0.62,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rootGroup.add(rainPoints);

  // 3. GREEN SLATE CHALKBOARD ON LEFT WALL (Dynamic Canvas Texture showing Lemma 3.2 & Rejections!)
  const chalkboardCanvas = document.createElement('canvas');
  chalkboardCanvas.width = 1024;
  chalkboardCanvas.height = 512;
  const chalkboardTex = new THREE.CanvasTexture(chalkboardCanvas);

  const chalkBoardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.55, 4.9),
    wainscotMat
  );
  chalkBoardFrame.position.set(-6.62, 3.1, -0.4);
  rootGroup.add(chalkBoardFrame);

  const chalkSurfaceMat = new THREE.MeshStandardMaterial({
    map: chalkboardTex,
    roughness: 0.85,
    metalness: 0.04,
  });
  const chalkSurface = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 2.32), chalkSurfaceMat);
  chalkSurface.rotation.y = Math.PI / 2;
  chalkSurface.position.set(-6.54, 3.1, -0.4);
  rootGroup.add(chalkSurface);

  // 4. DR. PAWN'S BATTERED OAK DESK, BANKER'S LAMP, CRT TERMINAL & REJECTION STACKS
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0, -0.6);
  rootGroup.add(deskGroup);

  const oakMat = new THREE.MeshStandardMaterial({
    color: 0x452c1e,
    roughness: 0.65,
    metalness: 0.08,
  });
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.12, 1.65), oakMat);
  deskTop.position.y = 1.02;
  const deskLeftPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.98, 1.5), oakMat);
  deskLeftPedestal.position.set(-1.18, 0.49, 0);
  const deskRightPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.98, 1.5), oakMat);
  deskRightPedestal.position.set(1.18, 0.49, 0);
  const deskModestyPanel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.78, 0.08), oakMat);
  deskModestyPanel.position.set(0, 0.55, -0.68);
  deskGroup.add(deskTop, deskLeftPedestal, deskRightPedestal, deskModestyPanel);

  // Classic Emerald-Green Glass Banker's Desk Lamp
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.28,
    metalness: 0.82,
  });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 16), brassMat);
  lampBase.position.set(-1.15, 1.11, -0.42);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 12), brassMat);
  lampStem.position.set(-1.15, 1.34, -0.42);
  const greenShadeMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    emissive: new THREE.Color(0x10b981),
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, 0.16, 16, 1, false, 0, Math.PI),
    greenShadeMat
  );
  lampShade.rotation.z = Math.PI / 2;
  lampShade.position.set(-1.15, 1.56, -0.38);
  deskGroup.add(lampBase, lampStem, lampShade);

  // Beige 1990s CRT Monitor with Dynamic LaTeX / Email Screen
  const crtPlasticMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.72,
    metalness: 0.08,
  });
  const crtBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.58), crtPlasticMat);
  crtBox.position.set(0.55, 1.42, -0.32);
  const crtStand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), crtPlasticMat);
  crtStand.position.set(0.55, 1.12, -0.32);
  const keyboardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.24), crtPlasticMat);
  keyboardMesh.position.set(0.52, 1.1, 0.24);
  deskGroup.add(crtBox, crtStand, keyboardMesh);

  const crtScreenCanvas = document.createElement('canvas');
  crtScreenCanvas.width = 512;
  crtScreenCanvas.height = 384;
  const crtScreenTex = new THREE.CanvasTexture(crtScreenCanvas);
  const crtScreenMat = new THREE.MeshBasicMaterial({ map: crtScreenTex });
  const crtScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), crtScreenMat);
  crtScreenMesh.position.set(0.55, 1.43, -0.025);
  deskGroup.add(crtScreenMesh);

  // Stacks of ungraded bluebooks, overdue mortgage bills, and rejected manuscripts on the desk
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
  const overduePinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.88 });
  for (let s = 0; s < 6; s++) {
    const stackH = 0.08 + (s % 3) * 0.06;
    const stack = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, stackH, 0.42),
      s === 2 ? overduePinkMat : paperMat
    );
    stack.position.set(-0.55 + (s % 3) * 0.36, 1.08 + stackH * 0.5, -0.15 + Math.floor(s / 3) * 0.45);
    stack.rotation.y = (s - 2.5) * 0.14;
    deskGroup.add(stack);
  }

  // 5. THE COFFEE MACHINE THAT HASN'T WORKED SINCE 1987 (on the right side credenza!)
  const coffeeMachineGroup = new THREE.Group();
  coffeeMachineGroup.position.set(4.35, 0, -2.55);
  rootGroup.add(coffeeMachineGroup);

  const credenza = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 1.1), wainscotMat);
  credenza.position.y = 0.525;
  coffeeMachineGroup.add(credenza);

  const coffeeBodyMat = new THREE.MeshStandardMaterial({
    color: 0xd6cbb5, // Yellowed 1987 beige plastic
    roughness: 0.65,
    metalness: 0.15,
  });
  const coffeeDarkTrim = new THREE.MeshStandardMaterial({
    color: 0x291d14, // 1987 faux wood-grain panel
    roughness: 0.75,
  });
  const cmBase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.48), coffeeBodyMat);
  cmBase.position.y = 1.09;
  const cmTower = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.24), coffeeBodyMat);
  cmTower.position.set(0, 1.41, -0.12);
  const cmHood = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.48), coffeeDarkTrim);
  cmHood.position.set(0, 1.66, 0);
  coffeeMachineGroup.add(cmBase, cmTower, cmHood);

  // Calcified empty glass carafe sitting cold on the burner
  const carafeMat = new THREE.MeshPhysicalMaterial({
    color: 0x78350f,
    transparent: true,
    opacity: 0.42,
    roughness: 0.35,
  });
  const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.32, 14), carafeMat);
  carafe.position.set(0, 1.29, 0.08);
  coffeeMachineGroup.add(carafe);

  // Flickering broken 1987 red indicator switch
  const coffeeLedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const coffeeSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), coffeeLedMat);
  coffeeSwitch.position.set(0.18, 1.66, 0.245);
  coffeeMachineGroup.add(coffeeSwitch);

  // Crooked yellow sticky note: "OUT OF ORDER SINCE 1987"
  const stickyMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const stickyNote = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), stickyMat);
  stickyNote.position.set(-0.05, 1.65, 0.246);
  stickyNote.rotation.z = -0.12;
  coffeeMachineGroup.add(stickyNote);

  // 6. DR. PAWN'S RESEARCH EQUIPMENT (Sold in Year 6 to pay the Perseus Arm Predatory Journal Fee!)
  const labEquipmentGroup = new THREE.Group();
  labEquipmentGroup.position.set(-4.2, 0, -2.5);
  rootGroup.add(labEquipmentGroup);

  const labBench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.15), wainscotMat);
  labBench.position.y = 0.5;
  labEquipmentGroup.add(labBench);

  // Tektronix-style Oscilloscope + Cryo-Dewar Cylinder + Signal Generator
  const scopeBox = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.48, 0.62), crtPlasticMat);
  scopeBox.position.set(-0.55, 1.24, 0);
  const scopeScreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const scopeScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.26), scopeScreenMat);
  scopeScreen.position.set(-0.66, 1.26, 0.315);
  const cryoDewar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.88, 18),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.25 })
  );
  cryoDewar.position.set(0.52, 1.44, -0.05);
  labEquipmentGroup.add(scopeBox, scopeScreen, cryoDewar);

  // 7. OFFICE LIGHTING (Warm Banker's Desk Lamp + Cold Rainy Window Moon/Streetlight + Dim Overhead Fluorescent)
  const deskLampLight = new THREE.PointLight(0xf59e0b, 8.5, 9.5, 1.6);
  deskLampLight.position.set(-0.9, 1.85, -0.4);
  rootGroup.add(deskLampLight);

  const windowMoonLight = new THREE.SpotLight(0x60a5fa, 14.0, 18.0, Math.PI / 3, 0.6, 1.2);
  windowMoonLight.position.set(0, 4.4, -4.0);
  windowMoonLight.target.position.set(0, 0.8, 0.5);
  rootGroup.add(windowMoonLight);
  rootGroup.add(windowMoonLight.target);

  const fluorescentLight = new THREE.PointLight(0xe2e8f0, 3.2, 14.0, 1.5);
  fluorescentLight.position.set(0, 5.6, 0.5);
  rootGroup.add(fluorescentLight);

  return {
    rootGroup,
    rainPoints,
    rainVelocities,
    windowDropletsMesh,
    chalkboardCanvas,
    chalkboardTex,
    crtScreenCanvas,
    crtScreenTex,
    coffeeMachineGroup,
    coffeeLedMat,
    labEquipmentGroup,
    deskLampLight,
    windowMoonLight,
    fluorescentLight,
    lastChalkSignature: '',
  };
}

export function updateUniversityOfficeScene(
  rig: UniversityOfficeRig,
  elapsed: number,
  rawDelta: number,
  state: {
    year: number;
    semesterLabel: string;
    lemmaIntegrity: number;
    journalRejections: number;
    hIndex: number;
    equipmentSold: boolean;
    publishedAccepted: boolean;
  }
) {
  // 1. Animate rain streaking down outside the University of Greater Andromeda window
  const posAttr = rig.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    let y = posAttr.getY(i) - rig.rainVelocities[i] * rawDelta;
    let x = posAttr.getX(i) - 0.35 * rawDelta;
    if (y < 1.2) {
      y = 5.3;
      x = (Math.random() - 0.5) * 5.2;
    }
    posAttr.setXYZ(i, x, y, posAttr.getZ(i));
  }
  posAttr.needsUpdate = true;

  // 2. Subtle 1987 broken coffee machine LED sputter & overhead fluorescent flicker
  const coffeeFlicker = Math.sin(elapsed * 19) * Math.cos(elapsed * 7.3) > 0.25 ? 1.0 : 0.18;
  rig.coffeeLedMat.color.setRGB(0.95 * coffeeFlicker, 0.15 * coffeeFlicker, 0.15 * coffeeFlicker);
  rig.fluorescentLight.intensity =
    3.0 + (Math.sin(elapsed * 43) > 0.92 ? -0.9 : Math.sin(elapsed * 2.1) * 0.15);

  // 3. Hide lab equipment if sold to pay the Perseus Arm predatory publication fee!
  rig.labEquipmentGroup.visible = !state.equipmentSold;

  // 4. Update Chalkboard & CRT Monitor Canvas when state changes
  const sig = `${state.year}_${state.semesterLabel}_${Math.round(state.lemmaIntegrity)}_${state.journalRejections}_${state.hIndex}_${state.equipmentSold}_${state.publishedAccepted}`;
  if (sig !== rig.lastChalkSignature) {
    rig.lastChalkSignature = sig;

    // Chalkboard painting
    const ctx = rig.chalkboardCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#143325';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, 1000, 488);

      ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(
        'DEPT. OF RETROCAUSAL MATHEMATICS — UNIV. OF GREATER ANDROMEDA',
        36,
        58
      );

      ctx.font = 'italic 24px Georgia, serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(
        'Manuscript: "On the Nonexistence of Monarchs in Retrocausal Systems" (Dr. Pawn)',
        36,
        108
      );

      ctx.font = '24px monospace';
      ctx.fillStyle = state.lemmaIntegrity >= 100 ? '#6ee7b7' : '#fca5a5';
      ctx.fillText(
        state.lemmaIntegrity >= 100
          ? '⊢ Central Lemma 3.2: ∀t < t₀ : ¬∃Monarch(E8) [RIGOROUSLY VERIFIED — Q.E.D.]'
          : `⊢ Central Lemma 3.2: [WARNING: GRAD STUDENT FOUND SIGN ERROR — ${state.lemmaIntegrity}% FIXED]`,
        36,
        172
      );

      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.font = '22px monospace';
      ctx.fillText(
        `• Journal of Transfinite Causality Rejections: ${state.journalRejections} / 3`,
        36,
        235
      );
      ctx.fillText(
        `• Dr. Pawn h-index: ${state.hIndex}   vs.   Prof. Rook h-index: 64 (3 identical papers!)`,
        36,
        282
      );
      ctx.fillText(
        `• Coffee Machine Status: BROKEN SINCE NOV 1987 (Work Order #00419 Pending)`,
        36,
        329
      );

      if (state.publishedAccepted) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 30px Georgia, serif';
        ctx.fillText(
          '★ ACCEPTED IN: GALACTIC ADVANCES IN THEORETICAL EVERYTHING (IF: 847.3) ★',
          36,
          415
        );
      } else if (state.journalRejections >= 3) {
        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillText(
          'DESPERATION: Contact "GALACTIC ADVANCES IN THEORETICAL EVERYTHING" (Perseus Arm)',
          36,
          415
        );
      }
      rig.chalkboardTex.needsUpdate = true;
    }

    // CRT Monitor painting
    const crt = rig.crtScreenCanvas.getContext('2d');
    if (crt) {
      crt.fillStyle = '#06140e';
      crt.fillRect(0, 0, 512, 384);
      crt.fillStyle = '#34d399';
      crt.font = 'bold 18px monospace';
      crt.fillText('PINE 4.64 — UGA FACULTY PINE MAIL', 20, 38);
      crt.fillText(`YEAR ${state.year} (${state.semesterLabel})`, 20, 68);
      crt.fillStyle = '#a7f3d0';
      crt.font = '15px monospace';
      crt.fillText(`> Lemma 3.2 Proof Integrity: ${state.lemmaIntegrity}%`, 20, 118);
      crt.fillText(`> J. Transfinite Causality Rejections: ${state.journalRejections}/3`, 20, 152);
      crt.fillText(`> Prof. Rook Tenure Status: FULL TENURE`, 20, 186);
      crt.fillText(
        state.publishedAccepted
          ? '> STATUS: MANUSCRIPT ACCEPTED! [Q.E.D.]'
          : '> STATUS: UNTENURED / PUBLISH OR PERISH',
        20,
        235
      );
      rig.crtScreenTex.needsUpdate = true;
    }
  }
}

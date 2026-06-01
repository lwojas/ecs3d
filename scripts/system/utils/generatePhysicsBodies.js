/**
 * Attach multiple invisible physics bodies to a main sprite based on rectangles
 * @param {Phaser.Sprite} mainSprite - the visible sprite
 * @param {Array<{x:number, y:number, width:number, height:number}>} rectangles - array of rectangles
 * @param {boolean} dynamic - true = dynamic bodies, false = static bodies
 */
export function attachRectangleBodies(mainSprite, rectangles, dynamic = true) {
  //   const proxyGroup = game.add.group(); // group to hold proxy sprites
  const proxyGroup = [];
  //   proxyGroup.visible = false; // hide proxies
  //   proxyGroup.enableBody = true;
  //   proxyGroup.physicsBodyType = Phaser.Physics.ARCADE;

  rectangles.forEach((rect) => {
    // position relative to main sprite
    const x = mainSprite.x - mainSprite.width / 2 + rect.x + rect.width / 2;
    const y = mainSprite.y - mainSprite.height / 2 + rect.y + rect.height / 2;

    const proxy = game.add.sprite(x, y);
    game.physics.arcade.enable(proxy);

    proxy.body.setSize(rect.width, rect.height);
    proxy.body.immovable = !dynamic;
    proxy.body.allowGravity = dynamic;

    proxyGroup.push(proxy);

    // Optional: if you want proxies to follow the main sprite
    // mainSprite.update = function () {
    //   proxyGroup.forEachAlive((p) => {
    //     p.x = mainSprite.x - mainSprite.width / 2 + (p.rectOffsetX || 0);
    //     p.y = mainSprite.y - mainSprite.height / 2 + (p.rectOffsetY || 0);
    //   });
    // };

    // Store offset for easy updating
    proxy.rectOffsetX = rect.x + rect.width / 2;
    proxy.rectOffsetY = rect.y + rect.height / 2;
  });

  return proxyGroup;
}

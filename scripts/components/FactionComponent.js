export class FactionComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.allegiance = data.allegiance || "civilian";
    this.faction = {
      player: data.faction?.player || 0,
      pirate: data.faction?.pirate || 0,
      police: data.faction?.police || 0,
      civilian: data.faction?.civilian || 0,
      trader: data.faction?.trader || 0,
    };
  }
}

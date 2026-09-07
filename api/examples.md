# 完整示例

一个能跑的最小插件。

---

## 完整示例

```java
public final class MyPlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        if (!RigidPhysicsProvider.isAvailable()) {
            getLogger().warning("GTRigidPhysics 未就绪，物理特性将不可用");
            return;
        }
        getServer().getPluginManager().registerEvents(this, this);
    }

    /** 玩家右键金锭 → 朝准星方向掷出一个骰子 */
    @EventHandler
    public void onInteract(PlayerInteractEvent event) {
        if (event.getItem() == null || event.getItem().getType() != Material.GOLD_INGOT) return;

        RigidPhysicsAPI api = RigidPhysicsProvider.getIfPresent().orElse(null);
        if (api == null || !api.isPhysicsAvailable()) return;

        Player player = event.getPlayer();
        Vector dir = player.getLocation().getDirection();

        SpawnOptions options = SpawnOptions.builder(
                        player.getEyeLocation().add(dir.clone().multiply(1.5)),
                        Material.GOLD_BLOCK)
                .templateId("myplugin_die")
                .type(PhysicsBodyType.DIE)
                .halfExtents(0.25)
                .mass(17.0)
                .velocity(dir.getX() * 8, 4, dir.getZ() * 8)
                .build();

        PhysicsBody die = api.bodies().spawn(options);
        if (die == null) {
            player.sendMessage("场上物体太多了，等一会儿再来");
            return;
        }
        player.sendMessage("掷出！");
    }

    /** 保护出生点附近不被坍塌波及 */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onCollapse(StructureCollapseStartEvent event) {
        Location spawn = event.getOrigin().getWorld().getSpawnLocation();
        if (event.getOrigin().distanceSquared(spawn) < 50 * 50) {
            event.setCancelled(true);
        }
    }
}
```

---

---

## 更完整的例子

仓库 `examples/` 下有三个真实 addon，都是「只依赖 api」的参考实现：

- [管理面板](../addons/panel.md) —— 只读查询、builder 模式、`Optional` 语义
- [工具腰带](../addons/toolbelt.md) —— **覆盖全部子服务**
- [载具系统](../addons/vehicle.md) —— 用公开 API 造一个完整玩法系统

---

## 相关

- [写自己的 addon](../addons/writing.md)
- [接入 API](index.md)

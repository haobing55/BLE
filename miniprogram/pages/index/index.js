Page({

  data: {
    devices: [],
    deviceId: "",
    serviceId: "",
    notifyCharId: "",
    writeCharId: "",
    input: "",
    recvData: "",
    isScanning: false,
    connectedDeviceName: ""
  },
  onShow() {

    wx.getBluetoothAdapterState({
      success: res => {
  
        console.log("当前蓝牙状态:", res)
  
        if (res.available) {
  
          wx.showToast({
            title: "蓝牙已开启",
            icon: "success"
          })
  
        }
  
      }
    })
  
  },
  // =========================
  // 1️⃣ 初始化蓝牙
  // =========================
  openBluetooth() {
    wx.openBluetoothAdapter({
      success: res => {
        console.log("蓝牙初始化成功", res)

        wx.onBluetoothAdapterStateChange(res => {
          console.log("蓝牙状态变化:", res)
        })

        wx.showToast({ title: "蓝牙已开启" })
      },
      fail: err => {
        console.log("初始化失败", err)

        if (err.errCode === 10001) {
      
          wx.showModal({
            title: "蓝牙未开启",
            content: "检测到手机蓝牙未开启，是否前往设置打开蓝牙？",
            success: res => {
      
              if (res.confirm) {
      
                wx.openSystemBluetoothSetting({
                  success() {
                    console.log("已打开蓝牙设置页")
                  },
                  fail(err) {
                    console.log("打开设置页失败", err)
                  }
                })
      
              }
      
            }
          })
      
        }
      }
    })
  },

  // =========================
  // 2️⃣ 扫描设备（稳定版）
  // =========================
  startScan() {

    if (this.data.isScanning) return

    this.setData({
      isScanning: true,
      devices: []
    })

    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {

        console.log("开始扫描成功")

        // 防止重复绑定
        wx.offBluetoothDeviceFound()

        wx.onBluetoothDeviceFound(res => {

          res.devices.forEach(device => {

            console.log("发现设备:", device)

            // ⚠️ 不依赖 name（很多设备 name 是空的）
            let list = this.data.devices

            // 去重
            let exists = list.find(d => d.deviceId === device.deviceId)

            if (!exists) {
              list.push(device)
              this.setData({ devices: list })
            }
          })
        })
      },
      fail: err => {
        console.log("扫描失败:", err)
        this.setData({ isScanning: false })
      }
    })
  },

  // =========================
  // 3️⃣ 连接设备
  // =========================
  connectDevice(e) {

    let deviceId = e.currentTarget.dataset.id

    this.setData({ deviceId })

    wx.createBLEConnection({
      deviceId,
      success: () => {

        console.log("连接成功")
       

        this.getServices(deviceId)
        console.log('打印1',this.getServices(deviceId))
      },
      fail: err => {
        console.log("连接失败:", err)
      }
    })
  },

  // =========================
  // 4️⃣ 获取服务
  // =========================
  getServices(deviceId) {

    wx.getBLEDeviceServices({
      deviceId,
      success: res => {
  
        console.log("服务列表:", res.services)

        let targetService = res.services.find(s =>
          s.uuid.includes("FFF0")
        )
        if (!targetService) return
        let serviceId = targetService.uuid

        this.setData({ serviceId })

        this.getCharacteristics(deviceId, serviceId)
      }
    })
  },

  // =========================
  // 5️⃣ 获取特征值
  // =========================
  getCharacteristics(deviceId, serviceId) {

    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: res => {

        console.log("特征值:", res.characteristics)

        res.characteristics.forEach(item => {

          const uuid = item.uuid
        
          // Notify
          if (uuid.includes("FFF1")) {
            this.setData({
              notifyCharId: uuid
            })
            this.openNotify(deviceId, serviceId, uuid)
          }
        
          // Write
          if (uuid.includes("FFF2")) {
            this.setData({
              writeCharId: uuid
            })
          }
        })
      }
    })
  },

  // =========================
  // 6️⃣ 开启 Notify（核心）
  // =========================
  openNotify(deviceId, serviceId, charId) {

      wx.offBLECharacteristicValueChange()

      wx.onBLECharacteristicValueChange(res => {
        let str = this.ab2hex(res.value)
        console.log("收到数据:", str)
    
        this.setData({ recvData: str })
      })
    
      wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId: charId,
        state: true,
        success: () => {
          console.log("Notify开启成功")
        },
        fail: err => {
          console.log("Notify失败:", err)
        }
      })     
  },

  // =========================
  // 7️⃣ 发送数据（FFF2）
  // =========================
  sendData() {

    if (!this.data.deviceId || !this.data.writeCharId) {
      wx.showToast({
        title: "未连接或FFF2未就绪",
        icon: "none"
      })
      return
    }

    let buffer = this.stringToBuffer(this.data.input)
    console.log("📤 发送内容(Hex):", buffer)
    wx.writeBLECharacteristicValue({
      deviceId: this.data.deviceId,
      serviceId: this.data.serviceId,
      characteristicId: this.data.writeCharId,
      value: buffer,
      
      success: () => {
        console.log("发送成功")
      },
      fail: err => {
        console.log("发送失败:", err)
      }
    })
  },

  inputChange(e) {
    this.setData({
      input: e.detail.value
    })
  },

  // =========================
  // 工具函数
  // =========================
  stringToBuffer(str) {
   
    let buffer = new ArrayBuffer(str.length)
    let dataView = new Uint8Array(buffer)

    for (let i = 0; i < str.length; i++) {
      dataView[i] = str.charCodeAt(i)
    }

    return buffer
  },

  ab2hex(buffer) {
     //发送ASCII码
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
})
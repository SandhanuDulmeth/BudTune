using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Rfcomm;
using Windows.Devices.Enumeration;
using Windows.Networking.Sockets;
using Windows.Storage.Streams;

internal sealed class Radio : IDisposable {
    readonly StreamSocket socket = new StreamSocket();
    DataReader input;
    DataWriter output;
    static async Task<T> Finish<T>(Windows.Foundation.IAsyncOperation<T> op,CancellationToken token) {
        using(token.Register(op.Cancel)) {
            while(op.Status==Windows.Foundation.AsyncStatus.Started) await Task.Delay(20,token);
            token.ThrowIfCancellationRequested();
            return op.GetResults();
        }
    }
    static async Task Finish(Windows.Foundation.IAsyncAction op,CancellationToken token) {
        using(token.Register(op.Cancel)) {
            while(op.Status==Windows.Foundation.AsyncStatus.Started) await Task.Delay(20,token);
            token.ThrowIfCancellationRequested();
            op.GetResults();
        }
    }

    public static async Task<List<DeviceInformation>> Devices(CancellationToken token) {
        var devices = await Finish(DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true)),token);
        return devices.Where(d => System.Text.RegularExpressions.Regex.IsMatch(d.Name, @"(?i)\b(R50i|P20i|P25i)\b") &&
            !System.Text.RegularExpressions.Regex.IsMatch(d.Name, @"(?i)\b(NC|ANC)\b")).ToList();
    }
    public async Task Connect(string id, CancellationToken token) {
        using (var device = await Finish(BluetoothDevice.FromIdAsync(id),token)) {
            if (device == null) throw new IOException("Windows could not open the paired earbuds.");
            var result = await Finish(device.GetRfcommServicesAsync(BluetoothCacheMode.Uncached),token);
            try {
                var service = result.Services.FirstOrDefault(s => s.ServiceId.Uuid.ToString().StartsWith("0cf12d31-fac3-4553-bd80-d6832e7", StringComparison.OrdinalIgnoreCase))
                    ?? result.Services.FirstOrDefault(s => s.ServiceId.Uuid == RfcommServiceId.SerialPort.Uuid);
                if (service == null) throw new IOException("Control service unavailable. Wake the earbuds and close the phone app.");
                await Finish(socket.ConnectAsync(service.ConnectionHostName, service.ConnectionServiceName),token);
                input = new DataReader(socket.InputStream);
                output = new DataWriter(socket.OutputStream);
            } finally { foreach (var s in result.Services) s.Dispose(); }
        }
    }
    public static byte[] Frame(byte group, byte command, params byte[] data) {
        var frame = new byte[10 + data.Length];
        frame[0]=8; frame[1]=238; frame[5]=group; frame[6]=command; frame[7]=(byte)frame.Length;
        data.CopyTo(frame,9);
        frame[frame.Length-1]=(byte)frame.Sum(b=>(int)b);
        return frame;
    }
    async Task Send(byte[] frame, CancellationToken token) {
        output.WriteBytes(frame);
        await Finish<uint>(output.StoreAsync(),token);
    }
    async Task<byte[]> ReadBytes(int length, CancellationToken token) {
        var bytes = new byte[length];
        if(await Finish<uint>(input.LoadAsync((uint)length),token)!=(uint)length) throw new EndOfStreamException("Earbuds disconnected.");
        input.ReadBytes(bytes);
        return bytes;
    }
    public async Task<byte[]> State(CancellationToken token) {
        await Send(Frame(1,1),token);
        while (true) {
            var h=await ReadBytes(9,token);
            int size=h[7]+256*h[8];
            if (h[0]!=9 || h[1]!=255 || h[2]!=0 || h[3]!=0 || h[4]!=1 || size<10 || size>4096)
                throw new IOException("Unexpected response header.");
            var body=await ReadBytes(size-9,token);
            int sum=h.Sum(v=>(int)v)+body.Take(body.Length-1).Sum(v=>(int)v);
            if ((byte)sum!=body.Last()) throw new IOException("Incomplete Bluetooth response. Please reconnect.");
            if (h[5]==1 && h[6]==1) {
                if(body.Length<74 || Encoding.ASCII.GetString(body,16,4)!="3949")
                    throw new IOException("This release supports model A3949 only.");
                return body;
            }
        }
    }
    public async Task<byte[]> Set(bool gaming, bool on, CancellationToken token) {
        await Send(Frame(1,(byte)(gaming?0x87:0x83),(byte)(on?1:0)),token);
        int field=gaming?71:72;
        for(int attempt=0;attempt<3;attempt++) {
            await Task.Delay(250,token);
            var state=await State(token);
            if(state[field]==(on?1:0)) return state;
        }
        throw new IOException("The earbuds did not confirm this change.");
    }
    public async Task<byte[]> Equalize(Preset preset,CancellationToken token) {
        await Send(Frame(2,0x83,preset.Payload),token);
        for(int i=0;i<3;i++) {
            await Task.Delay(250,token);
            var updated=await State(token);
            if(updated[32]==preset.Payload[0] && updated[33]==0) return updated;
        }
        throw new IOException("The earbuds did not confirm the EQ preset.");
    }
    public void Dispose() { socket.Dispose(); }
}



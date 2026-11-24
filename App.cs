using System;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Windows.Devices.Enumeration;

internal class Desk : Form {
    readonly ComboBox devices = new ComboBox { DropDownStyle=ComboBoxStyle.DropDownList, Width=215, DisplayMember="Name" };
    readonly Label status = new Label(), battery = new Label(), firmware = new Label();
    readonly Button scan = ActionButton("Scan"), connect = ActionButton("Connect"), refresh = ActionButton("Refresh");
    readonly Button game = ActionButton("Gaming mode"), tone = ActionButton("Touch tone");
    readonly ComboBox presets=new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList, Width=215};
    readonly Button apply=ActionButton("Apply preset");
    Radio radio;
    byte[] state;
    bool busy;
    CancellationTokenSource operation;
    static readonly Color ink=Color.FromArgb(29,46,55), teal=Color.FromArgb(13,108,99);
    public Desk() {
        Text="BudTune"; Font=new Font("Segoe UI",10); BackColor=Color.FromArgb(241,246,243); ForeColor=ink;
        AutoScaleMode=AutoScaleMode.Dpi; ClientSize=new Size(620,610); MinimumSize=new Size(585,610);
        var page=new FlowLayoutPanel { Dock=DockStyle.Fill, Padding=new Padding(24), FlowDirection=FlowDirection.TopDown, WrapContents=false, AutoScroll=true };
        Controls.Add(page);
        page.Controls.Add(Heading("BudTune",30)); page.Controls.Add(Heading("Soundcore R50i  /  P20i  /  P25i",11));
        page.Controls.Add(Heading("My earbuds",15));
        page.Controls.Add(Row(devices,scan,connect));
        var pairing=new LinkLabel { Text="Open Windows Bluetooth pairing", AutoSize=true, LinkColor=teal };
        pairing.LinkClicked+=(s,e)=>Process.Start(new ProcessStartInfo("ms-settings:bluetooth"){UseShellExecute=true});
        page.Controls.Add(pairing);
        page.Controls.Add(Heading("Battery and firmware",15));
        foreach(var label in new[]{battery,firmware,status}) { label.AutoSize=true; label.MaximumSize=new Size(490,0); label.Margin=new Padding(4,4,4,4); }
        page.Controls.Add(battery); page.Controls.Add(firmware);
        page.Controls.Add(Heading("Equalizer",15));
        presets.Items.AddRange(Preset.All);
        page.Controls.Add(Row(presets,apply));
        apply.Click+=async(s,e)=>{var preset=presets.SelectedItem as Preset;if(preset!=null)await Run(async t=>{state=await radio.Equalize(preset,t);status.Text="EQ preset confirmed by the earbuds.";});};
        page.Controls.Add(Heading("Listening controls",15)); page.Controls.Add(Row(game,tone,refresh)); page.Controls.Add(status);
        scan.Click+=async (s,e)=>await Run(Scan);
        connect.Click+=async(s,e)=>await Run(Connect);
        refresh.Click+=async(s,e)=>await Run(async t=>{state=await radio.State(t);status.Text="Updated from your earbuds.";});
        game.Click+=async(s,e)=>await Change(true); tone.Click+=async(s,e)=>await Change(false);
        devices.SelectedIndexChanged+=(s,e)=>{Disconnect(); Render();};
        Shown+=async(s,e)=>await Run(Scan);
        FormClosing+=(s,e)=>{if(operation!=null)operation.Cancel(); Disconnect();};
        Render();
    }
    static Label Heading(string text,int size) {
        return new Label{Text=text,Font=new Font("Segoe UI",size,FontStyle.Bold),AutoSize=true,Margin=new Padding(2,size==15?15:1,2,4)};
    }
    static Button ActionButton(string title) {
        return new Button {Text=title,AutoSize=true,Height=36,FlatStyle=FlatStyle.Flat,BackColor=Color.White,Padding=new Padding(6,1,6,1)};
    }
    static FlowLayoutPanel Row(params Control[] controls) {
        var row=new FlowLayoutPanel { AutoSize=true,WrapContents=false,Margin=new Padding(0,4,0,5) };
        row.Controls.AddRange(controls); return row;
    }
    async Task Scan(CancellationToken token) {
        Disconnect(); devices.Items.Clear(); status.Text="Looking for paired earbuds…";
        foreach(var item in await Radio.Devices(token)) devices.Items.Add(item);
        if(devices.Items.Count>0)devices.SelectedIndex=0;
        status.Text=devices.Items.Count==0?"Pair your A3949 earbuds in Windows, then select Scan.":"Select your earbuds and connect.";
    }
    async Task Connect(CancellationToken token) {
        Disconnect(); radio=new Radio(); status.Text="Connecting…";
        await radio.Connect(((DeviceInformation)devices.SelectedItem).Id,token);
        state=await radio.State(token); status.Text="Connected. Settings are read from your earbuds.";
    }
    async Task Change(bool gaming) {
        await Run(async token=>{status.Text="Waiting for the earbuds…";state=await radio.Set(gaming,state[gaming?71:72]==0,token);status.Text="Change confirmed by the earbuds.";});
    }
    async Task Run(Func<CancellationToken,Task> action) {
        if(busy)return;
        busy=true; Render();
        using(operation=new CancellationTokenSource(12000)) {
            try { await action(operation.Token); }
            catch(Exception ex) { Disconnect(); if(!IsDisposed) status.Text=ex is OperationCanceledException?"Connection timed out. Wake the earbuds, then reconnect.":ex.Message; }
            finally { operation=null;busy=false;if(!IsDisposed)Render(); }
        }
    }
    void Disconnect() {state=null;if(radio!=null){radio.Dispose();radio=null;}}
    static string Charge(byte level,byte charging) {return level>5?"Unavailable":(level*20)+"%"+(charging==1?" · charging":"");}
    static string Version(byte[] data,int offset) {
        var value=Encoding.ASCII.GetString(data,offset,5);
        return value.All(c=>char.IsDigit(c)||c=='.')?value:"—";
    }
    void Render() {
        devices.Enabled=scan.Enabled=!busy;connect.Enabled=!busy && devices.SelectedIndex>=0;
        game.Enabled=tone.Enabled=refresh.Enabled=!busy && state!=null;
        presets.Enabled=apply.Enabled=!busy && state!=null;
        if(!busy)presets.SelectedItem=state==null?null:Preset.All.FirstOrDefault(p=>p.Payload[0]==state[32] && state[33]==0);
        battery.Text=state==null?"Left  —       Right  —":"Left   "+Charge(state[2],state[4])+"       Right   "+Charge(state[3],state[5]);
        firmware.Text=state==null?"Firmware  —":"Firmware     L  "+Version(state,6)+"     R  "+Version(state,11);
        game.Text="Gaming mode"+(state==null?"":state[71]==1?"  ·  On":"  ·  Off");
        tone.Text="Touch tone"+(state==null?"":state[72]==1?"  ·  On":"  ·  Off");
    }
    [STAThread] public static void Main() {Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new Desk());}
}


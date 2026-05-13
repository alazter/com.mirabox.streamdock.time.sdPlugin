using System;
using System.Runtime.InteropServices;

public class VolumeControl
{
    [ComImport, Guid("bcde0395-e52f-467c-8e3d-c4579291692e")]
    private class MMDeviceEnumerator { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr ppDevices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl();
        [PreserveSig] int GetSimpleAudioVolume();
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    }

    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int SessionCount);
        [PreserveSig] int GetSession(int SessionCount, out IAudioSessionControl2 Session);
    }

    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionControl2
    {
        [PreserveSig] int GetState(out int pRetVal);
        [PreserveSig] int GetDisplayName(out IntPtr pRetVal);
        [PreserveSig] int SetDisplayName(string Value, Guid EventContext);
        [PreserveSig] int GetIconPath(out IntPtr pRetVal);
        [PreserveSig] int SetIconPath(string Value, Guid EventContext);
        [PreserveSig] int GetGroupingParam(out Guid pRetVal);
        [PreserveSig] int SetGroupingParam(Guid Override, Guid EventContext);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr NewNotifications);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr NewNotifications);
        [PreserveSig] int GetSessionIdentifier(out IntPtr pRetVal);
        [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr pRetVal);
        [PreserveSig] int GetProcessId(out uint pRetVal);
    }

    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float fLevel, ref Guid EventContext);
        [PreserveSig] int GetMasterVolume(out float pfLevel);
        [PreserveSig] int SetMute(int bMute, ref Guid EventContext);
        [PreserveSig] int GetMute(out int pbMute);
    }

    public static void Main(string[] args)
    {
        if (args.Length == 0) { Console.WriteLine("USAGE: VolumeControl.exe <pid_or_name|list> [new_volume_0_to_100|toggle_mute]"); return; }

        string targetInput = args[0].ToLower().Replace(".exe", "");
        bool listMode = (targetInput == "list");
        uint targetPid = 0;
        bool isPid = !listMode && uint.TryParse(targetInput, out targetPid);

        string targetProcessName = null;
        if (isPid)
        {
            try {
                targetProcessName = System.Diagnostics.Process.GetProcessById((int)targetPid).ProcessName.ToLower();
            } catch { }
        }
        else if (!listMode)
        {
            targetProcessName = targetInput;
        }

        try
        {
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(0, 1, out device);

            Guid iid = typeof(IAudioSessionManager2).GUID;
            object o;
            device.Activate(ref iid, 1, IntPtr.Zero, out o);
            IAudioSessionManager2 manager = (IAudioSessionManager2)o;

            IAudioSessionEnumerator sessionEnum;
            manager.GetSessionEnumerator(out sessionEnum);
            int count;
            sessionEnum.GetCount(out count);

            if (listMode)
            {
                System.Collections.Generic.List<string> procNames = new System.Collections.Generic.List<string>();
                for (int i = 0; i < count; i++)
                {
                    IAudioSessionControl2 sessionCtrl;
                    sessionEnum.GetSession(i, out sessionCtrl);
                    uint pid;
                    sessionCtrl.GetProcessId(out pid);
                    if (pid == 0) {
                        IntPtr instIdPtr;
                        sessionCtrl.GetSessionInstanceIdentifier(out instIdPtr);
                        if (instIdPtr != IntPtr.Zero)
                        {
                            string instId = Marshal.PtrToStringUni(instIdPtr).ToLower();
                            Marshal.FreeCoTaskMem(instIdPtr);
                            if (instId.Contains(".exe%"))
                            {
                                int exeIdx = instId.LastIndexOf(".exe%");
                                int slashIdx = instId.LastIndexOf('\\', exeIdx);
                                if (slashIdx != -1 && exeIdx > slashIdx)
                                {
                                    string extracted = instId.Substring(slashIdx + 1, exeIdx - slashIdx + 3); // includes .exe
                                    if (!procNames.Contains(extracted)) procNames.Add(extracted);
                                }
                            }
                            else if (instId.Contains("spotify"))
                            {
                                if (!procNames.Contains("spotify.exe")) procNames.Add("spotify.exe");
                            }
                        }
                        continue;
                    }
                    try
                    {
                        string processName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
                        string exeName = processName.ToLower() + ".exe";
                        if (!procNames.Contains(exeName)) {
                            procNames.Add(exeName);
                        }
                    }
                    catch { }
                }
                Console.WriteLine(string.Join(",", procNames));
                return;
            }

            for (int i = 0; i < count; i++)
            {
                IAudioSessionControl2 sessionCtrl;
                sessionEnum.GetSession(i, out sessionCtrl);
                uint pid;
                sessionCtrl.GetProcessId(out pid);

                bool match = false;
                if (pid == 0) {
                    IntPtr instIdPtr;
                    sessionCtrl.GetSessionInstanceIdentifier(out instIdPtr);
                    if (instIdPtr != IntPtr.Zero)
                    {
                        string instId = Marshal.PtrToStringUni(instIdPtr).ToLower();
                        Marshal.FreeCoTaskMem(instIdPtr);
                        if (!string.IsNullOrEmpty(targetProcessName) && instId.Contains(targetProcessName))
                        {
                            match = true;
                        }
                    }
                } else {
                    if (isPid && pid == targetPid)
                    {
                        match = true;
                    }
                    else if (!string.IsNullOrEmpty(targetProcessName))
                    {
                        try
                        {
                            string sName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLower();
                            if (sName == targetProcessName || sName + ".exe" == targetProcessName) {
                                match = true;
                            }
                        } catch { } // Process might have exited or permission denied
                    }
                }

                if (match)
                {
                    ISimpleAudioVolume simpleVol = sessionCtrl as ISimpleAudioVolume;
                    if (simpleVol != null)
                    {
                        if (args.Length > 1)
                        {
                            if (args[1].ToLower() == "toggle_mute")
                            {
                                int isMuted;
                                simpleVol.GetMute(out isMuted);
                                Guid ctx = Guid.Empty;
                                simpleVol.SetMute(isMuted == 0 ? 1 : 0, ref ctx);
                            }
                            else
                            {
                                float newVol;
                                if (float.TryParse(args[1], out newVol))
                                {
                                    newVol = Math.Max(0, Math.Min(1, newVol / 100f));
                                    Guid ctx = Guid.Empty;
                                    simpleVol.SetMasterVolume(newVol, ref ctx);
                                }
                            }
                        }
                        float curVol;
                        simpleVol.GetMasterVolume(out curVol);
                        int finalMute;
                        simpleVol.GetMute(out finalMute);
                        Console.WriteLine(Math.Round(curVol * 100) + "|" + finalMute);
                        return;
                    }
                }
            }
            Console.WriteLine("-1");
        }
        catch (Exception ex)
        {
            Console.WriteLine("-1"); // Error case
        }
    }
}

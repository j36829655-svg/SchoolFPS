using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace SchoolFPS.EditorTools
{
    /// <summary>
    /// GitHub Actions(GameCI)가 호출하는 빌드 진입점.
    /// Build Settings에 등록된 씬이 없으면 GreyboxSceneBuilder로 학교 맵을 만들어서 빌드한다.
    /// 직접 만든 씬을 Build Settings에 등록하고 커밋하면 그 씬이 대신 빌드된다.
    /// </summary>
    public static class BuildScript
    {
        [MenuItem("SchoolFPS/Build WebGL")]
        public static void BuildWebGL()
        {
            string[] scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (scenes.Length == 0)
            {
                GreyboxSceneBuilder.Build();
                scenes = new[] { GreyboxSceneBuilder.ScenePath };
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(GreyboxSceneBuilder.ScenePath, true) };
            }

            PlayerSettings.productName = "SchoolFPS";
            PlayerSettings.companyName = "SchoolFPS";
            // GitHub Pages는 압축 파일용 헤더를 못 붙이므로 압축을 끈다
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;

            string path = GetArg("-customBuildPath") ?? "build/WebGL/SchoolFPS";

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = path,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            });

            Debug.Log($"[SchoolFPS] Build {report.summary.result}: {report.summary.totalSize / (1024 * 1024)} MB, {report.summary.totalErrors} errors → {path}");

            if (Application.isBatchMode)
                EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
        }

        private static string GetArg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}
